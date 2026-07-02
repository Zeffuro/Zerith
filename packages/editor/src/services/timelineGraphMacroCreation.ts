import type { Command, GameManifest } from '@zeffuro/zerith-core';

import type { OpenProjectEntryOptions } from './openProjectEntry/contracts';

import { fsMkdir, fsReadTextFile, fsWriteTextFile } from './fs';

export type CreateMissingCallMacroDependencies = {
    mkdir?: (path: string, recursive?: boolean) => Promise<void>;
    openProjectEntry?: (path: string, entryName: string, options?: OpenProjectEntryOptions) => Promise<void>;
    readTextFile?: (path: string) => Promise<string>;
    reloadManifest?: () => Promise<void>;
    writeTextFile?: (path: string, content: string) => Promise<void>;
};

export type CreateMissingCallMacroRequest = {
    dirtyFiles?: ReadonlySet<string>;
    macroName: string;
    manifest?: GameManifest;
    projectPath?: string;
};

export type CreateMissingCallMacroResult =
    | { macroName: string; macrosPath: string; status: 'created' }
    | { macroName: string; macrosPath: string; status: 'exists' }
    | { message: string; status: 'blocked' };

export type MissingCallMacroPlan =
    | {
        macroName: string;
        macrosDirectory: string;
        macrosPath: string;
        status: 'ready';
    }
    | { message: string; status: 'blocked' };

export async function createMissingCallMacro(
    request: CreateMissingCallMacroRequest,
    dependencies: CreateMissingCallMacroDependencies = {},
): Promise<CreateMissingCallMacroResult> {
    const plan = resolveMissingCallMacroPlan(request);
    if (plan.status === 'blocked') {
        return plan;
    }

    const deps = resolveDependencies(dependencies);
    const macros = await readMacrosRecord(plan.macrosPath, deps.readTextFile);
    if (!macros) {
        return {
            message: `Macros file could not be parsed as an object: ${plan.macrosPath}`,
            status: 'blocked',
        };
    }

    if (macros[plan.macroName] !== undefined) {
        await deps.openProjectEntry(plan.macrosPath, basename(plan.macrosPath), { forceView: 'timeline' });
        return {
            macroName: plan.macroName,
            macrosPath: plan.macrosPath,
            status: 'exists',
        };
    }

    const nextMacros = {
        ...macros,
        [plan.macroName]: createMacroStub(),
    };

    await deps.mkdir(plan.macrosDirectory, true);
    await deps.writeTextFile(plan.macrosPath, JSON.stringify(nextMacros, undefined, 4));
    await deps.reloadManifest?.();
    await deps.openProjectEntry(plan.macrosPath, basename(plan.macrosPath), { forceView: 'timeline' });

    return {
        macroName: plan.macroName,
        macrosPath: plan.macrosPath,
        status: 'created',
    };
}

export function resolveMissingCallMacroPlan(request: CreateMissingCallMacroRequest): MissingCallMacroPlan {
    const macroName = request.macroName.trim();
    if (!macroName) {
        return { message: 'Macro call target name is empty.', status: 'blocked' };
    }

    if (isUnsafeObjectKey(macroName)) {
        return { message: `Macro name '${macroName}' cannot be used as a JSON object key.`, status: 'blocked' };
    }

    const projectPath = request.projectPath?.trim();
    if (!projectPath) {
        return { message: 'Open a project before creating macro call targets.', status: 'blocked' };
    }

    if (typeof request.manifest?.macros !== 'string') {
        return { message: 'Macro call target creation requires a file-backed manifest macros path.', status: 'blocked' };
    }

    const macrosPath = resolveProjectFilePath(projectPath, request.manifest.macros);
    if (!macrosPath) {
        return { message: 'Macro call target creation does not support external macros paths.', status: 'blocked' };
    }

    if (isDirtyPath(macrosPath, request.dirtyFiles)) {
        return {
            message: 'Save the macros file before creating macro call targets.',
            status: 'blocked',
        };
    }

    return {
        macroName,
        macrosDirectory: dirname(macrosPath),
        macrosPath,
        status: 'ready',
    };
}

function basename(path: string): string {
    return path.split(/[\\/]/u).findLast(Boolean) ?? path;
}

function createMacroStub(): Command[] {
    return [{ name: 'start', type: 'label' }];
}

async function defaultOpenProjectEntry(
    path: string,
    entryName: string,
    options?: OpenProjectEntryOptions,
): Promise<void> {
    const { openProjectEntry } = await import('./openProjectEntry/lazy');
    await openProjectEntry(path, entryName, options);
}

function dirname(path: string): string {
    const normalized = path.replaceAll('\\', '/');
    const index = normalized.lastIndexOf('/');
    return index === -1 ? '' : normalized.slice(0, index);
}

function isDirtyPath(path: string, dirtyFiles: ReadonlySet<string> | undefined): boolean {
    if (!dirtyFiles) return false;
    const normalizedPath = normalizePath(path);
    for (const dirtyFile of dirtyFiles) {
        if (normalizePath(dirtyFile) === normalizedPath) {
            return true;
        }
    }
    return false;
}

function isExternalPath(path: string): boolean {
    return /^(?:[a-z]+:)?\/\//iu.test(path) || path.startsWith('data:');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUnsafeObjectKey(value: string): boolean {
    return ['__proto__', 'constructor', 'prototype'].includes(value);
}

function joinPath(left: string, right: string): string {
    return `${left.replaceAll(/[\\/]+$/gu, '')}/${right.replaceAll(/^[\\/]+/gu, '')}`;
}

function normalizePath(path: string): string {
    return path.replaceAll('\\', '/').replace(/\/+$/u, '').toLowerCase();
}

async function readMacrosRecord(
    macrosPath: string,
    readTextFile: (path: string) => Promise<string>,
): Promise<Record<string, Command[]> | undefined> {
    let text: string;
    try {
        text = await readTextFile(macrosPath);
    } catch {
        return {};
    }

    try {
        const parsed: unknown = JSON.parse(text);
        if (!isRecord(parsed)) return;
        return parsed as Record<string, Command[]>;
    } catch {
        return;
    }
}

function resolveDependencies(dependencies: CreateMissingCallMacroDependencies): Required<CreateMissingCallMacroDependencies> {
    return {
        mkdir: dependencies.mkdir ?? fsMkdir,
        openProjectEntry: dependencies.openProjectEntry ?? defaultOpenProjectEntry,
        readTextFile: dependencies.readTextFile ?? fsReadTextFile,
        reloadManifest: dependencies.reloadManifest ?? (async () => {}),
        writeTextFile: dependencies.writeTextFile ?? fsWriteTextFile,
    };
}

function resolveProjectFilePath(projectPath: string, assetPath: string): string | undefined {
    if (isExternalPath(assetPath)) return undefined;
    return assetPath.startsWith('/')
        ? joinPath(projectPath, assetPath.slice(1))
        : joinPath(projectPath, assetPath);
}

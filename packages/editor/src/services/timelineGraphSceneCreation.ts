import type { GameManifest } from 'core';

import type { OpenProjectEntryOptions } from './openProjectEntry/contracts';

import { fsMkdir, fsReadTextFile, fsWriteTextFile } from './fs';

export type CreateMissingJumpSceneDependencies = {
    mkdir?: (path: string, recursive?: boolean) => Promise<void>;
    openProjectEntry?: (path: string, entryName: string, options?: OpenProjectEntryOptions) => Promise<void>;
    readTextFile?: (path: string) => Promise<string>;
    reloadManifest?: () => Promise<void>;
    writeTextFile?: (path: string, content: string) => Promise<void>;
};

export type CreateMissingJumpSceneRequest = {
    activeFile?: string;
    dirtyFiles?: ReadonlySet<string>;
    manifest?: GameManifest;
    projectPath?: string;
    sceneName: string;
};

export type CreateMissingJumpSceneResult =
    | { message: string; status: 'blocked' }
    | { sceneName: string; scenePath: string; status: 'created' }
    | { sceneName: string; scenePath?: string; status: 'exists' };

export type MissingJumpScenePlan =
    | {
        manifestPath: string;
        sceneDirectory: string;
        sceneFileName: string;
        sceneName: string;
        scenePath: string;
        sceneReference: string;
        status: 'ready';
    }
    | { message: string; status: 'blocked' };

export async function createMissingJumpScene(
    request: CreateMissingJumpSceneRequest,
    dependencies: CreateMissingJumpSceneDependencies = {},
): Promise<CreateMissingJumpSceneResult> {
    const plan = resolveMissingJumpScenePlan(request);
    if (plan.status === 'blocked') {
        return plan;
    }

    const deps = resolveDependencies(dependencies);

    if (await fileExists(plan.scenePath, deps.readTextFile)) {
        return {
            message: `Scene file already exists: ${plan.scenePath}`,
            status: 'blocked',
        };
    }

    const manifestText = await deps.readTextFile(plan.manifestPath);
    const manifest = parseManifestRecord(manifestText);
    if (!manifest) {
        return {
            message: 'game.json could not be parsed as a manifest object.',
            status: 'blocked',
        };
    }

    const scenes = isRecord(manifest.scenes) ? { ...manifest.scenes } : {};
    const existingScene = scenes[plan.sceneName];
    if (existingScene !== undefined) {
        const existingPath = typeof existingScene === 'string'
            ? resolveProjectFilePath(request.projectPath!, existingScene)
            : undefined;
        if (existingPath) {
            await deps.openProjectEntry(existingPath, basename(existingPath), { forceView: 'timeline' });
        }
        return {
            sceneName: plan.sceneName,
            scenePath: existingPath,
            status: 'exists',
        };
    }

    scenes[plan.sceneName] = plan.sceneReference;

    await deps.mkdir(plan.sceneDirectory, true);
    await deps.writeTextFile(plan.scenePath, createSceneStub(plan.sceneName, manifest.schemaVersion));
    await deps.writeTextFile(plan.manifestPath, JSON.stringify({
        ...manifest,
        scenes,
    }, undefined, 4));

    await deps.reloadManifest?.();
    await deps.openProjectEntry(plan.scenePath, plan.sceneFileName, { forceView: 'timeline' });

    return {
        sceneName: plan.sceneName,
        scenePath: plan.scenePath,
        status: 'created',
    };
}

export function resolveMissingJumpScenePlan(request: CreateMissingJumpSceneRequest): MissingJumpScenePlan {
    const sceneName = request.sceneName.trim();
    if (!sceneName) {
        return { message: 'Jump target scene name is empty.', status: 'blocked' };
    }

    const projectPath = request.projectPath?.trim();
    if (!projectPath) {
        return { message: 'Open a project before creating jump target scenes.', status: 'blocked' };
    }

    const manifestPath = joinPath(projectPath, 'game.json');
    if (isDirtyPath(manifestPath, request.dirtyFiles)) {
        return {
            message: 'Save game.json before creating a jump target scene.',
            status: 'blocked',
        };
    }

    const existingScene = request.manifest?.scenes?.[sceneName];
    if (existingScene !== undefined) {
        return {
            message: `Scene '${sceneName}' already exists in game.json.`,
            status: 'blocked',
        };
    }

    const sceneFileName = `${sanitizeSceneFileName(sceneName)}.json`;
    const sceneDirectory = resolveSceneDirectory(request, projectPath);
    const scenePath = joinPath(sceneDirectory, sceneFileName);

    return {
        manifestPath,
        sceneDirectory,
        sceneFileName,
        sceneName,
        scenePath,
        sceneReference: toProjectRelativePath(projectPath, scenePath),
        status: 'ready',
    };
}

function basename(path: string): string {
    return path.split(/[\\/]/).pop() || path;
}

function createSceneStub(sceneName: string, schemaVersion: unknown): string {
    const effectiveSchemaVersion = schemaVersion === 1 || schemaVersion === 2 ? schemaVersion : 2;
    return JSON.stringify({
        $schema: 'zerith/scene',
        commands: [
            { name: 'start', type: 'label' },
            {
                lineId: `${sceneName}.001`,
                speaker: 'Narrator',
                text: 'New scene.',
                type: 'dialogue',
            },
        ],
        localeNamespace: sceneName,
        schemaVersion: effectiveSchemaVersion,
    }, undefined, 4);
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

async function fileExists(path: string, readTextFile: (path: string) => Promise<string>): Promise<boolean> {
    try {
        await readTextFile(path);
        return true;
    } catch {
        return false;
    }
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

function isPathInsideProject(projectPath: string, filePath: string): boolean {
    const project = normalizePath(projectPath);
    const file = normalizePath(filePath);
    return file === project || file.startsWith(`${project}/`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function joinPath(left: string, right: string): string {
    return `${left.replaceAll(/[\\/]+$/gu, '')}/${right.replaceAll(/^[\\/]+/gu, '')}`;
}

function normalizePath(path: string): string {
    return path.replaceAll('\\', '/').replace(/\/+$/u, '').toLowerCase();
}

function parseManifestRecord(text: string): Record<string, unknown> | undefined {
    try {
        const parsed: unknown = JSON.parse(text);
        return isRecord(parsed) ? parsed : undefined;
    } catch {
        return undefined;
    }
}

function resolveDependencies(dependencies: CreateMissingJumpSceneDependencies): Required<CreateMissingJumpSceneDependencies> {
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

function resolveSceneDirectory(
    request: CreateMissingJumpSceneRequest,
    projectPath: string,
): string {
    const activeFile = request.activeFile;
    if (activeFile && isPathInsideProject(projectPath, activeFile)) {
        return dirname(activeFile);
    }

    const sceneEntries = Object.values(request.manifest?.scenes ?? {});
    for (const entry of sceneEntries) {
        if (typeof entry !== 'string') continue;
        const scenePath = resolveProjectFilePath(projectPath, entry);
        if (scenePath) {
            return dirname(scenePath);
        }
    }

    return joinPath(projectPath, 'scenes');
}

function sanitizeSceneFileName(sceneName: string): string {
    const sanitized = sceneName
        .trim()
        .replaceAll(/[^\w.-]+/gu, '_')
        .replaceAll(/^_+|_+$/gu, '');
    return sanitized || 'scene';
}

function toProjectRelativePath(projectPath: string, filePath: string): string {
    const project = normalizePath(projectPath);
    const file = filePath.replaceAll('\\', '/');
    const normalizedFile = normalizePath(filePath);
    if (normalizedFile.startsWith(`${project}/`)) {
        return file.slice(projectPath.replaceAll('\\', '/').replace(/\/+$/u, '').length + 1);
    }
    return file;
}

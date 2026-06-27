import type { ScriptPath } from '../utils/scriptPathUtilities';
import type { ReferenceLocation } from './referenceScanner/types';

import { isRecord } from '../utils/typeGuards';
import { fsReadTextFile, fsWriteTextFile } from './fs';
import { normalizeAssetReference, toProjectAssetUrl } from './referenceScanner/assets';

export type AssetReferenceBatchRewriteRequest = {
    dirtyFiles?: ReadonlySet<string>;
    projectPath: string;
    replacements: readonly AssetReferenceReplacement[];
};

export type AssetReferenceReplacement = {
    newAssetUrl: string;
    oldAssetUrl: string;
    references: readonly ReferenceLocation[];
};

export type AssetReferenceRewriteFile = {
    content: string;
    filePath: string;
    replacementCount: number;
};

export type AssetReferenceRewritePlan = {
    blockedDirtyFiles: string[];
    files: AssetReferenceRewriteFile[];
    replacementCount: number;
};

export type AssetReferenceRewriteRequest = {
    dirtyFiles?: ReadonlySet<string>;
    newAssetUrl: string;
    oldAssetUrl: string;
    projectPath: string;
    references: readonly ReferenceLocation[];
};

export type AssetReferenceRewriteServiceDependencies = {
    readTextFile: (path: string) => Promise<string>;
    writeTextFile: (path: string, content: string) => Promise<void>;
};

type FormatAssetReferenceRequest = {
    filePath: string;
} & Pick<AssetReferenceRewriteRequest, 'newAssetUrl' | 'projectPath'>;

type NormalizeAssetReferenceForFileRequest = {
    filePath: string;
} & Pick<AssetReferenceRewriteRequest, 'projectPath'>;

type RewriteAssetReferenceJsonRequest = {
    filePath: string;
} & Pick<AssetReferenceRewriteRequest, 'newAssetUrl' | 'oldAssetUrl' | 'projectPath' | 'references'>;

type RewriteAssetStringRequest = {
    filePath: string;
} & Pick<AssetReferenceRewriteRequest, 'newAssetUrl' | 'oldAssetUrl' | 'projectPath'>;

const defaultAssetReferenceRewriteDependencies: AssetReferenceRewriteServiceDependencies = {
    readTextFile: fsReadTextFile,
    writeTextFile: fsWriteTextFile,
};

export async function applyAssetReferenceRewritePlan(
    plan: Pick<AssetReferenceRewritePlan, 'files'>,
    dependencies: Pick<AssetReferenceRewriteServiceDependencies, 'writeTextFile'> = defaultAssetReferenceRewriteDependencies,
): Promise<void> {
    for (const file of plan.files) {
        await dependencies.writeTextFile(file.filePath, file.content);
    }
}

export function formatAssetReferenceReplacement(
    currentValue: string,
    request: FormatAssetReferenceRequest,
): string {
    const { base, cueSuffix } = splitCueSuffix(currentValue);
    const replacementBase = formatAssetReferenceBase(base, request);
    const slashAdjusted = base.includes('\\') && !base.includes('/')
        ? replacementBase.replaceAll('/', '\\')
        : replacementBase;
    return `${slashAdjusted}${cueSuffix}`;
}

export function getDirtyAssetReferenceFiles(
    references: readonly ReferenceLocation[],
    dirtyFiles: ReadonlySet<string> | undefined,
): string[] {
    if (!dirtyFiles || dirtyFiles.size === 0) return [];

    const dirtyReferenceFiles = new Set<string>();
    for (const reference of references) {
        if (isDirtyPath(reference.filePath, dirtyFiles)) {
            dirtyReferenceFiles.add(reference.filePath);
        }
    }

    return [...dirtyReferenceFiles].toSorted((left, right) => left.localeCompare(right));
}

export async function prepareAssetReferenceBatchRewritePlan(
    request: AssetReferenceBatchRewriteRequest,
    dependencies: AssetReferenceRewriteServiceDependencies = defaultAssetReferenceRewriteDependencies,
): Promise<AssetReferenceRewritePlan> {
    const allReferences = request.replacements.flatMap((replacement) => [...replacement.references]);
    const blockedDirtyFiles = getDirtyAssetReferenceFiles(allReferences, request.dirtyFiles);
    if (blockedDirtyFiles.length > 0) {
        return { blockedDirtyFiles, files: [], replacementCount: 0 };
    }

    const files: AssetReferenceRewriteFile[] = [];
    const replacementsByFile = groupReplacementsByFile(request.replacements);

    for (const [filePath, replacements] of replacementsByFile) {
        const text = await dependencies.readTextFile(filePath);
        const parsed = JSON.parse(text) as unknown;
        let replacementCount = 0;

        for (const replacement of replacements) {
            replacementCount += rewriteAssetReferencesInJson(parsed, {
                filePath,
                newAssetUrl: replacement.newAssetUrl,
                oldAssetUrl: replacement.oldAssetUrl,
                projectPath: request.projectPath,
                references: replacement.references,
            });
        }

        if (replacementCount > 0) {
            files.push({
                content: `${JSON.stringify(parsed, undefined, 4)}\n`,
                filePath,
                replacementCount,
            });
        }
    }

    return {
        blockedDirtyFiles,
        files,
        replacementCount: files.reduce((total, file) => total + file.replacementCount, 0),
    };
}

export async function prepareAssetReferenceRewritePlan(
    request: AssetReferenceRewriteRequest,
    dependencies: AssetReferenceRewriteServiceDependencies = defaultAssetReferenceRewriteDependencies,
): Promise<AssetReferenceRewritePlan> {
    const blockedDirtyFiles = getDirtyAssetReferenceFiles(request.references, request.dirtyFiles);
    if (blockedDirtyFiles.length > 0) {
        return { blockedDirtyFiles, files: [], replacementCount: 0 };
    }

    const files: AssetReferenceRewriteFile[] = [];
    const referencesByFile = groupReferencesByFile(request.references);

    for (const [filePath, references] of referencesByFile) {
        const text = await dependencies.readTextFile(filePath);
        const parsed = JSON.parse(text) as unknown;
        const replacementCount = rewriteAssetReferencesInJson(parsed, {
            filePath,
            newAssetUrl: request.newAssetUrl,
            oldAssetUrl: request.oldAssetUrl,
            projectPath: request.projectPath,
            references,
        });

        if (replacementCount > 0) {
            files.push({
                content: `${JSON.stringify(parsed, undefined, 4)}\n`,
                filePath,
                replacementCount,
            });
        }
    }

    return {
        blockedDirtyFiles,
        files,
        replacementCount: files.reduce((total, file) => total + file.replacementCount, 0),
    };
}

export function rewriteAssetReferencesInJson(
    root: unknown,
    request: RewriteAssetReferenceJsonRequest,
): number {
    let replacementCount = 0;
    const visited = new Set<string>();

    for (const reference of request.references) {
        const path = resolveJsonPathForReference(root, reference);
        if (!path || path.length === 0) continue;

        const visitKey = path.join('\u0000');
        if (visited.has(visitKey)) continue;
        visited.add(visitKey);

        const target = getPathValue(root, path);
        if (typeof target === 'string') {
            const next = rewriteAssetString(target, request);
            if (next !== target && setPathValue(root, path, next)) {
                replacementCount += 1;
            }
            continue;
        }

        replacementCount += rewriteAssetStringsDeep(target, request);
    }

    return replacementCount;
}

function formatAssetReferenceBase(
    currentBase: string,
    request: FormatAssetReferenceRequest,
): string {
    const normalizedBase = currentBase.replaceAll('\\', '/');
    if (normalizedBase.startsWith('/assets/')) return request.newAssetUrl;
    if (normalizedBase.startsWith('assets/')) return request.newAssetUrl.slice(1);

    const fileAssetUrl = toProjectAssetUrl(request.filePath, request.projectPath);
    if (fileAssetUrl && isPlainRelativeAssetReference(normalizedBase)) {
        return relativeAssetUrlFromFile(fileAssetUrl, request.newAssetUrl);
    }

    return request.newAssetUrl.replace(/^\/assets\//u, '');
}

function getPathValue(root: unknown, path: ScriptPath): unknown {
    let current = root;
    for (const segment of path) {
        if (Array.isArray(current) && typeof segment === 'number') {
            current = current[segment];
            continue;
        }

        if (isRecord(current) && typeof segment === 'string') {
            current = current[segment];
            continue;
        }

        return undefined;
    }

    return current;
}

function groupReferencesByFile(references: readonly ReferenceLocation[]): Map<string, ReferenceLocation[]> {
    const referencesByFile = new Map<string, ReferenceLocation[]>();
    for (const reference of references) {
        const entries = referencesByFile.get(reference.filePath) ?? [];
        entries.push(reference);
        referencesByFile.set(reference.filePath, entries);
    }

    return new Map([...referencesByFile].toSorted(([left], [right]) => left.localeCompare(right)));
}

function groupReplacementsByFile(
    replacements: readonly AssetReferenceReplacement[],
): Map<string, AssetReferenceReplacement[]> {
    const replacementsByFile = new Map<string, AssetReferenceReplacement[]>();

    for (const replacement of replacements) {
        const referencesByFile = groupReferencesByFile(replacement.references);
        for (const [filePath, references] of referencesByFile) {
            const entries = replacementsByFile.get(filePath) ?? [];
            entries.push({
                ...replacement,
                references,
            });
            replacementsByFile.set(filePath, entries);
        }
    }

    return new Map([...replacementsByFile].toSorted(([left], [right]) => left.localeCompare(right)));
}

function isDirtyPath(path: string, dirtyFiles: ReadonlySet<string>): boolean {
    const normalizedPath = normalizePath(path);
    for (const dirtyFile of dirtyFiles) {
        if (normalizePath(dirtyFile) === normalizedPath) return true;
    }

    return false;
}

function isPlainRelativeAssetReference(value: string): boolean {
    return Boolean(value)
        && !value.startsWith('/')
        && !value.startsWith('\\')
        && !value.startsWith('assets/')
        && !/^(?:[a-z]+:)?\/\//iu.test(value)
        && !value.startsWith('data:');
}

function joinAssetUrl(baseAssetUrl: string, relativeAssetPath: string): string {
    const baseSegments = baseAssetUrl.replaceAll('\\', '/').split('/');
    baseSegments.pop();

    for (const segment of relativeAssetPath.replaceAll('\\', '/').split('/')) {
        if (!segment || segment === '.') continue;
        if (segment === '..') {
            if (baseSegments.length > 1) baseSegments.pop();
            continue;
        }
        baseSegments.push(segment);
    }

    const joined = baseSegments.join('/').replaceAll(/\/+/gu, '/');
    return joined.startsWith('/') ? joined : `/${joined}`;
}

function normalizeAssetReferenceForFile(
    value: string,
    request: NormalizeAssetReferenceForFileRequest,
): string | undefined {
    const { base } = splitCueSuffix(value);
    const fileAssetUrl = toProjectAssetUrl(request.filePath, request.projectPath);
    if (fileAssetUrl && isPlainRelativeAssetReference(base)) {
        return normalizeAssetReference(joinAssetUrl(fileAssetUrl, base));
    }

    return normalizeAssetReference(base);
}

function normalizePath(path: string): string {
    return path.replaceAll('\\', '/').replaceAll(/\/+/gu, '/').toLowerCase();
}

function relativeAssetUrlFromFile(fileAssetUrl: string, targetAssetUrl: string): string {
    const fromSegments = fileAssetUrl.split('/').filter(Boolean);
    fromSegments.pop();
    const toSegments = targetAssetUrl.split('/').filter(Boolean);

    while (fromSegments.length > 0 && toSegments.length > 0 && fromSegments[0] === toSegments[0]) {
        fromSegments.shift();
        toSegments.shift();
    }

    const relativeSegments = [
        ...fromSegments.map(() => '..'),
        ...toSegments,
    ];
    return relativeSegments.length === 0 ? '.' : relativeSegments.join('/');
}

function resolveJsonPathForReference(root: unknown, reference: ReferenceLocation): ScriptPath | undefined {
    if (reference.sceneName.startsWith('macro:')) {
        const macroName = reference.sceneName.slice('macro:'.length);
        if (!macroName || !isRecord(root) || !(macroName in root)) return undefined;

        if (reference.path[1] === 'body') {
            return [macroName, ...reference.path.slice(2)];
        }

        return [macroName, ...reference.path];
    }

    if (isRecord(root) && Array.isArray(root.commands)) {
        return ['commands', ...reference.path];
    }

    return reference.path;
}

function rewriteAssetString(
    value: string,
    request: RewriteAssetStringRequest,
): string {
    const normalized = normalizeAssetReferenceForFile(value, request);
    return normalized === request.oldAssetUrl
        ? formatAssetReferenceReplacement(value, request)
        : value;
}

function rewriteAssetStringsDeep(
    value: unknown,
    request: RewriteAssetStringRequest,
): number {
    if (Array.isArray(value)) {
        let replacementCount = 0;
        for (const [index, entry] of value.entries()) {
            if (typeof entry === 'string') {
                const next = rewriteAssetString(entry, request);
                if (next !== entry) {
                    value[index] = next;
                    replacementCount += 1;
                }
                continue;
            }

            replacementCount += rewriteAssetStringsDeep(entry, request);
        }

        return replacementCount;
    }

    if (!isRecord(value)) return 0;

    let replacementCount = 0;
    for (const [key, entry] of Object.entries(value)) {
        if (typeof entry === 'string') {
            const next = rewriteAssetString(entry, request);
            if (next !== entry) {
                value[key] = next;
                replacementCount += 1;
            }
            continue;
        }

        replacementCount += rewriteAssetStringsDeep(entry, request);
    }

    return replacementCount;
}

function setPathValue(root: unknown, path: ScriptPath, value: unknown): boolean {
    if (path.length === 0) return false;

    const parent = getPathValue(root, path.slice(0, -1));
    const last = path.at(-1);
    if (Array.isArray(parent) && typeof last === 'number') {
        parent[last] = value;
        return true;
    }

    if (isRecord(parent) && typeof last === 'string') {
        parent[last] = value;
        return true;
    }

    return false;
}

function splitCueSuffix(value: string): { base: string; cueSuffix: string } {
    if (value.includes('://')) {
        return { base: value, cueSuffix: '' };
    }

    const cueSeparatorIndex = value.lastIndexOf(':');
    if (cueSeparatorIndex <= 0) {
        return { base: value, cueSuffix: '' };
    }

    return {
        base: value.slice(0, cueSeparatorIndex),
        cueSuffix: value.slice(cueSeparatorIndex),
    };
}

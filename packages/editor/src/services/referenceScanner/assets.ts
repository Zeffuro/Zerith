import type { GlobalSearchProjectData } from '../globalSearch';
import type { AssetDependencyGraph, ReferenceLocation, ReferenceScannerResult } from './types';

import { isRecord, toRecord } from '../../utils/typeGuards';
import { fsJoin, fsReadDirectory, fsReadTextFile } from '../fs';
import { resolveFilePath } from './paths';

const ASSETS_PREFIX = '/assets/';

export async function collectDataAssetReferences(
    projectData: Pick<GlobalSearchProjectData, 'characters' | 'items' | 'manifest' | 'projectPath'>,
    result: ReferenceScannerResult,
): Promise<void> {
    const { projectPath } = projectData;
    if (!projectPath) return;

    const manifestRecord = toRecord(projectData.manifest);
    const charactersFilePath = resolveFilePath(projectPath, typeof manifestRecord.characters === 'string' ? manifestRecord.characters : undefined);
    const itemsFilePath = resolveFilePath(projectPath, typeof manifestRecord.items === 'string' ? manifestRecord.items : undefined);

    for (const [characterKey, character] of Object.entries(projectData.characters)) {
        if (!isRecord(character)) continue;

        const spritesheet = toRecord(character.spritesheet);
        const atlasUrl = typeof spritesheet.atlasUrl === 'string' ? spritesheet.atlasUrl : undefined;
        if (atlasUrl) {
            const atlasLocation: ReferenceLocation = {
                commandType: 'character.spritesheet.atlasUrl',
                filePath: charactersFilePath,
                path: [characterKey, 'spritesheet', 'atlasUrl'],
                sceneName: 'data:characters',
            };
            pushNormalizedAssetReference(result.assetFiles, atlasUrl, atlasLocation);

            const sourceAssetUrl = await resolveDescriptorSourceAssetUrl(atlasUrl, projectPath);
            if (sourceAssetUrl) {
                pushNormalizedAssetReference(
                    result.assetFiles,
                    sourceAssetUrl,
                    {
                        ...atlasLocation,
                        commandType: 'character.spritesheet.source',
                        path: [characterKey, 'spritesheet', 'source'],
                    },
                );
            }
        }

        const portraitUrl = typeof character.portraitUrl === 'string' ? character.portraitUrl : undefined;
        if (portraitUrl) {
            pushNormalizedAssetReference(
                result.assetFiles,
                portraitUrl,
                {
                    commandType: 'character.portraitUrl',
                    filePath: charactersFilePath,
                    path: [characterKey, 'portraitUrl'],
                    sceneName: 'data:characters',
                },
            );
        }
    }

    for (const [itemKey, item] of Object.entries(projectData.items)) {
        if (!isRecord(item)) continue;
        const imageUrl = typeof item.imageUrl === 'string' ? item.imageUrl : undefined;
        if (!imageUrl) continue;

        pushNormalizedAssetReference(
            result.assetFiles,
            imageUrl,
            {
                commandType: 'item.imageUrl',
                filePath: itemsFilePath,
                path: [itemKey, 'imageUrl'],
                sceneName: 'data:items',
            },
        );
    }
}

export function createAssetDependencyGraph(
    assetReferences: Record<string, ReferenceLocation[]>,
    assetInventory: string[],
): AssetDependencyGraph {
    const inventorySet = new Set(assetInventory);
    const used = Object.entries(assetReferences)
        .map(([assetUrl, references]) => ({ assetUrl, references }))
        .toSorted((left, right) => left.assetUrl.localeCompare(right.assetUrl));

    const missing = used.filter((entry) => !inventorySet.has(entry.assetUrl));
    const usedAssetUrls = new Set(used.map((entry) => entry.assetUrl));
    const unused = assetInventory
        .filter((assetUrl) => !usedAssetUrls.has(assetUrl))
        .toSorted((left, right) => left.localeCompare(right));

    return { missing, unused, used };
}

export async function listProjectAssetFiles(projectPath: string): Promise<string[]> {
    const assetsRoot = await fsJoin(projectPath, 'assets');
    const assetUrls: string[] = [];

    await walkAssetDirectory(assetsRoot, '/assets', assetUrls);
    return assetUrls.toSorted((left, right) => left.localeCompare(right));
}

export function normalizeAssetReference(assetUrl: string): string | undefined {
    const trimmed = assetUrl.trim();
    if (!trimmed) return undefined;
    if (/^[a-z]+:\/\//i.test(trimmed)) return undefined;

    const normalizedSlashes = trimmed.replaceAll('\\', '/');
    const cueSeparatorIndex = normalizedSlashes.includes('://')
        ? -1
        : normalizedSlashes.lastIndexOf(':');
    const withoutCue = cueSeparatorIndex > 0
        ? normalizedSlashes.slice(0, cueSeparatorIndex)
        : normalizedSlashes;

    let absoluteCandidate = withoutCue;
    if (!withoutCue.startsWith('/')) {
        absoluteCandidate = withoutCue.startsWith('assets/')
            ? `/${withoutCue}`
            : `${ASSETS_PREFIX}${withoutCue.replaceAll(/^\/+/g, '')}`;
    }

    const collapsed = absoluteCandidate.replaceAll(/\/+/g, '/');
    return collapsed.startsWith(ASSETS_PREFIX) ? collapsed : undefined;
}


export function toProjectAssetUrl(filePath: string, projectPath: string | undefined): string | undefined {
    if (!projectPath) return undefined;

    const normalizedProject = projectPath.replaceAll('\\', '/').replaceAll(/\/+$/g, '');
    const normalizedFile = filePath.replaceAll('\\', '/');
    if (!normalizedFile.startsWith(normalizedProject)) return undefined;

    const relative = normalizedFile.slice(normalizedProject.length);
    const absolute = relative.startsWith('/') ? relative : `/${relative}`;
    return absolute.startsWith(ASSETS_PREFIX) ? absolute : undefined;
}

function joinAssetUrl(baseAssetUrl: string, relativeAssetPath: string): string {
    const baseSegments = baseAssetUrl.replaceAll('\\', '/').split('/');
    if (baseSegments.length > 0) {
        baseSegments.pop();
    }

    for (const segment of relativeAssetPath.replaceAll('\\', '/').split('/')) {
        if (!segment || segment === '.') continue;
        if (segment === '..') {
            if (baseSegments.length > 1) baseSegments.pop();
            continue;
        }
        baseSegments.push(segment);
    }

    const joined = baseSegments.join('/');
    return joined.startsWith('/') ? joined : `/${joined}`;
}

function pushNormalizedAssetReference(
    map: Record<string, ReferenceLocation[]>,
    assetReference: string,
    location: ReferenceLocation,
): void {
    const normalized = normalizeAssetReference(assetReference);
    if (!normalized) return;

    if (!map[normalized]) {
        map[normalized] = [];
    }
    map[normalized].push(location);
}

async function resolveDescriptorSourceAssetUrl(
    atlasUrl: string,
    projectPath: string,
): Promise<string | undefined> {
    const descriptorPath = resolveFilePath(projectPath, atlasUrl);

    let descriptorText: string;
    try {
        descriptorText = await fsReadTextFile(descriptorPath);
    } catch {
        return undefined;
    }

    let descriptorData: unknown;
    try {
        descriptorData = JSON.parse(descriptorText);
    } catch {
        return undefined;
    }

    if (!isRecord(descriptorData) || typeof descriptorData.source !== 'string') {
        return undefined;
    }

    const source = descriptorData.source;
    if (source.startsWith('/') || source.startsWith('assets/')) {
        return normalizeAssetReference(source);
    }

    return normalizeAssetReference(joinAssetUrl(atlasUrl, source));
}

async function walkAssetDirectory(directoryPath: string, assetPrefix: string, output: string[]): Promise<void> {
    let entries;
    try {
        entries = await fsReadDirectory(directoryPath);
    } catch {
        return;
    }

    for (const entry of entries) {
        const absoluteChildPath = await fsJoin(directoryPath, entry.name);
        const childAssetPath = `${assetPrefix}/${entry.name}`.replaceAll(/\/+/g, '/');

        if (entry.isDirectory) {
            await walkAssetDirectory(absoluteChildPath, childAssetPath, output);
            continue;
        }

        if (entry.isFile) {
            output.push(childAssetPath);
        }
    }
}


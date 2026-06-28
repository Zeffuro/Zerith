import { isRecord } from '../utils/typeGuards';
import { fsJoin, fsMkdir, fsReadTextFile, fsWriteTextFile } from './fs';

export const ASSET_LIBRARY_METADATA_FILE_NAME = '.zerith-library.json';
export const ASSET_LIBRARY_METADATA_TYPE = 'zerith.assetLibrary';
export const ASSET_LIBRARY_METADATA_SCHEMA_VERSION = 1;

export type AssetLibraryAssetMetadata = {
    collections: string[];
    tags: string[];
};

export type AssetLibraryMetadata = {
    assets: Record<string, AssetLibraryAssetMetadata>;
    schemaVersion: typeof ASSET_LIBRARY_METADATA_SCHEMA_VERSION;
    type: typeof ASSET_LIBRARY_METADATA_TYPE;
};

export type AssetLibraryMetadataDependencies = {
    join: (...parts: string[]) => Promise<string>;
    mkdir: (path: string, recursive?: boolean) => Promise<void>;
    readTextFile: (path: string) => Promise<string>;
    writeTextFile: (path: string, content: string) => Promise<void>;
};

const defaultDependencies: AssetLibraryMetadataDependencies = {
    join: fsJoin,
    mkdir: fsMkdir,
    readTextFile: fsReadTextFile,
    writeTextFile: fsWriteTextFile,
};

export function createEmptyAssetLibraryMetadata(): AssetLibraryMetadata {
    return {
        assets: {},
        schemaVersion: ASSET_LIBRARY_METADATA_SCHEMA_VERSION,
        type: ASSET_LIBRARY_METADATA_TYPE,
    };
}

export function addAssetLibraryCollectionToAssets(
    metadata: AssetLibraryMetadata,
    assetUrls: readonly string[],
    collection: string,
): AssetLibraryMetadata {
    return addAssetLibraryMetadataToAssets(metadata, assetUrls, { collections: [collection] });
}

export function addAssetLibraryMetadataToAssets(
    metadata: AssetLibraryMetadata,
    assetUrls: readonly string[],
    assetMetadata: Partial<AssetLibraryAssetMetadata>,
): AssetLibraryMetadata {
    const normalizedAssetMetadata = normalizeAssetLibraryAssetMetadata(assetMetadata);
    if (
        assetUrls.length === 0
        || (normalizedAssetMetadata.collections.length === 0 && normalizedAssetMetadata.tags.length === 0)
    ) {
        return normalizeAssetLibraryMetadata(metadata);
    }

    let next = normalizeAssetLibraryMetadata(metadata);
    for (const assetUrl of assetUrls) {
        const normalizedAssetUrl = normalizeAssetLibraryAssetUrl(assetUrl);
        if (!normalizedAssetUrl) continue;

        const current = next.assets[normalizedAssetUrl] ?? { collections: [], tags: [] };
        next = setAssetLibraryAssetMetadata(next, normalizedAssetUrl, {
            collections: [...current.collections, ...normalizedAssetMetadata.collections],
            tags: [...current.tags, ...normalizedAssetMetadata.tags],
        });
    }

    return normalizeAssetLibraryMetadata(next);
}

export async function loadAssetLibraryMetadata(
    projectPath: string,
    dependencies: AssetLibraryMetadataDependencies = defaultDependencies,
): Promise<AssetLibraryMetadata> {
    const metadataPath = await assetLibraryMetadataPath(projectPath, dependencies);

    let raw: string;
    try {
        raw = await dependencies.readTextFile(metadataPath);
    } catch {
        return createEmptyAssetLibraryMetadata();
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch (error) {
        throw new Error(`Asset library metadata is invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }

    return normalizeAssetLibraryMetadata(parsed);
}

export function moveAssetLibraryMetadataScope(
    metadata: AssetLibraryMetadata,
    oldAssetUrl: string,
    newAssetUrl: string,
): AssetLibraryMetadata {
    const normalizedOldUrl = normalizeAssetLibraryAssetUrl(oldAssetUrl);
    const normalizedNewUrl = normalizeAssetLibraryAssetUrl(newAssetUrl);
    if (!normalizedOldUrl || !normalizedNewUrl || normalizedOldUrl === normalizedNewUrl) {
        return normalizeAssetLibraryMetadata(metadata);
    }

    const next = createEmptyAssetLibraryMetadata();
    const oldPrefix = trimTrailingSlash(normalizedOldUrl);
    const newPrefix = trimTrailingSlash(normalizedNewUrl);

    for (const [assetUrl, assetMetadata] of Object.entries(metadata.assets)) {
        const normalizedAssetUrl = normalizeAssetLibraryAssetUrl(assetUrl);
        if (!normalizedAssetUrl) continue;

        const targetUrl = normalizedAssetUrl === oldPrefix || normalizedAssetUrl.startsWith(`${oldPrefix}/`)
            ? `${newPrefix}${normalizedAssetUrl.slice(oldPrefix.length)}`
            : normalizedAssetUrl;
        next.assets[targetUrl] = mergeAssetLibraryAssetMetadata(next.assets[targetUrl], assetMetadata);
    }

    return normalizeAssetLibraryMetadata(next);
}

export function normalizeAssetLibraryLabels(labels: unknown): string[] {
    if (!Array.isArray(labels)) return [];

    const normalized = new Map<string, string>();
    for (const label of labels) {
        if (typeof label !== 'string') continue;
        const trimmed = label.trim().replaceAll(/\s+/gu, ' ');
        if (!trimmed) continue;

        const key = trimmed.toLocaleLowerCase();
        if (!normalized.has(key)) {
            normalized.set(key, trimmed);
        }
    }

    return [...normalized.values()].toSorted((left, right) => left.localeCompare(right));
}

export function normalizeAssetLibraryMetadata(value: unknown): AssetLibraryMetadata {
    const metadata = createEmptyAssetLibraryMetadata();
    if (!isRecord(value)) return metadata;

    const rawAssets = isRecord(value.assets) ? value.assets : {};
    for (const [assetUrl, rawAssetMetadata] of Object.entries(rawAssets)) {
        const normalizedAssetUrl = normalizeAssetLibraryAssetUrl(assetUrl);
        if (!normalizedAssetUrl || !isRecord(rawAssetMetadata)) continue;

        const assetMetadata = normalizeAssetLibraryAssetMetadata(rawAssetMetadata);
        if (assetMetadata.collections.length === 0 && assetMetadata.tags.length === 0) continue;

        metadata.assets[normalizedAssetUrl] = assetMetadata;
    }

    return metadata;
}

export function parseAssetLibraryLabelInput(value: string): string[] {
    return normalizeAssetLibraryLabels(value.split(/[,\n]/u));
}

export function removeAssetLibraryCollection(
    metadata: AssetLibraryMetadata,
    collection: string,
): AssetLibraryMetadata {
    const [normalizedCollection] = normalizeAssetLibraryLabels([collection]);
    if (!normalizedCollection) {
        return normalizeAssetLibraryMetadata(metadata);
    }

    const collectionKey = labelKey(normalizedCollection);
    const next = createEmptyAssetLibraryMetadata();
    for (const [assetUrl, assetMetadata] of Object.entries(normalizeAssetLibraryMetadata(metadata).assets)) {
        const collections = assetMetadata.collections.filter((label) => labelKey(label) !== collectionKey);
        const nextAssetMetadata = normalizeAssetLibraryAssetMetadata({
            ...assetMetadata,
            collections,
        });
        if (nextAssetMetadata.collections.length > 0 || nextAssetMetadata.tags.length > 0) {
            next.assets[assetUrl] = nextAssetMetadata;
        }
    }

    return normalizeAssetLibraryMetadata(next);
}

export function renameAssetLibraryCollection(
    metadata: AssetLibraryMetadata,
    oldCollection: string,
    newCollection: string,
): AssetLibraryMetadata {
    const [normalizedOldCollection] = normalizeAssetLibraryLabels([oldCollection]);
    const [normalizedNewCollection] = normalizeAssetLibraryLabels([newCollection]);
    if (!normalizedOldCollection || !normalizedNewCollection) {
        return normalizeAssetLibraryMetadata(metadata);
    }

    const oldCollectionKey = labelKey(normalizedOldCollection);
    const newCollectionKey = labelKey(normalizedNewCollection);
    if (oldCollectionKey === newCollectionKey && normalizedOldCollection === normalizedNewCollection) {
        return normalizeAssetLibraryMetadata(metadata);
    }

    const next = createEmptyAssetLibraryMetadata();
    for (const [assetUrl, assetMetadata] of Object.entries(normalizeAssetLibraryMetadata(metadata).assets)) {
        const collections = assetMetadata.collections.map((label) => (
            labelKey(label) === oldCollectionKey ? normalizedNewCollection : label
        ));
        const nextAssetMetadata = normalizeAssetLibraryAssetMetadata({
            ...assetMetadata,
            collections,
        });
        if (nextAssetMetadata.collections.length > 0 || nextAssetMetadata.tags.length > 0) {
            next.assets[assetUrl] = nextAssetMetadata;
        }
    }

    return normalizeAssetLibraryMetadata(next);
}

export async function saveAssetLibraryMetadata(
    projectPath: string,
    metadata: AssetLibraryMetadata,
    dependencies: AssetLibraryMetadataDependencies = defaultDependencies,
): Promise<void> {
    const assetsPath = await dependencies.join(projectPath, 'assets');
    await dependencies.mkdir(assetsPath, true);
    const metadataPath = await dependencies.join(assetsPath, ASSET_LIBRARY_METADATA_FILE_NAME);
    await dependencies.writeTextFile(metadataPath, `${JSON.stringify(normalizeAssetLibraryMetadata(metadata), undefined, 4)}\n`);
}

export function setAssetLibraryAssetMetadata(
    metadata: AssetLibraryMetadata,
    assetUrl: string,
    assetMetadata: Partial<AssetLibraryAssetMetadata>,
): AssetLibraryMetadata {
    const normalizedAssetUrl = normalizeAssetLibraryAssetUrl(assetUrl);
    if (!normalizedAssetUrl) return normalizeAssetLibraryMetadata(metadata);

    const next = normalizeAssetLibraryMetadata(metadata);
    const normalizedAssetMetadata = normalizeAssetLibraryAssetMetadata(assetMetadata);
    if (normalizedAssetMetadata.collections.length === 0 && normalizedAssetMetadata.tags.length === 0) {
        delete next.assets[normalizedAssetUrl];
    } else {
        next.assets[normalizedAssetUrl] = normalizedAssetMetadata;
    }

    return normalizeAssetLibraryMetadata(next);
}

async function assetLibraryMetadataPath(
    projectPath: string,
    dependencies: Pick<AssetLibraryMetadataDependencies, 'join'>,
): Promise<string> {
    const assetsPath = await dependencies.join(projectPath, 'assets');
    return dependencies.join(assetsPath, ASSET_LIBRARY_METADATA_FILE_NAME);
}

function mergeAssetLibraryAssetMetadata(
    left: AssetLibraryAssetMetadata | undefined,
    right: AssetLibraryAssetMetadata,
): AssetLibraryAssetMetadata {
    return {
        collections: normalizeAssetLibraryLabels([...(left?.collections ?? []), ...right.collections]),
        tags: normalizeAssetLibraryLabels([...(left?.tags ?? []), ...right.tags]),
    };
}

function normalizeAssetLibraryAssetMetadata(value: unknown): AssetLibraryAssetMetadata {
    const record = isRecord(value) ? value : {};
    return {
        collections: normalizeAssetLibraryLabels(record.collections),
        tags: normalizeAssetLibraryLabels(record.tags),
    };
}

function labelKey(label: string): string {
    return label.toLocaleLowerCase();
}

function normalizeAssetLibraryAssetUrl(assetUrl: string): string | undefined {
    const normalized = assetUrl.trim().replaceAll('\\', '/').replaceAll(/\/+/gu, '/');
    if (!normalized) return;
    if (normalized.startsWith('/assets/')) return normalized;
    if (normalized.startsWith('assets/')) return `/${normalized}`;
    return;
}

function trimTrailingSlash(value: string): string {
    return value.replaceAll(/\/+$/gu, '');
}

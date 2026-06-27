export interface CompiledAssetDependencies {
    audio: string[];
    audiosheets: string[];
    spritesheets: string[];
    textures: string[];
}

export interface CompiledContentAssets {
    all: CompiledAssetDependencies;
    byScene: Record<string, CompiledAssetDependencies>;
    global: CompiledAssetDependencies;
}

export interface CompiledContentCacheEntry {
    hash: string;
    kind: CompiledContentCacheEntryKind;
    size: number;
}

export type CompiledContentCacheEntryKind = 'asset' | 'content';

export interface CompiledContentCacheManifest {
    algorithm: 'sha256';
    entries: Record<string, CompiledContentCacheEntry>;
}

export interface CompiledContentCacheSource {
    kind: CompiledContentCacheEntryKind;
    path: string;
}

export interface CompiledContentManifest {
    $schema: 'zerith/compiled-content';
    assets: CompiledContentAssets;
    cache?: CompiledContentCacheManifest;
    compilerVersion: 1;
    contentSchemaVersion?: 1 | 2;
    locales?: Record<string, CompiledLocaleSummary>;
    scenes: Record<string, CompiledSceneSummary>;
    source: CompiledContentSourceSummary;
}

export interface CompiledContentSourceSummary {
    startScene?: string;
    title?: string;
    version?: string;
}

export interface CompiledLocaleSummary {
    entryCount: number;
    namespaces: string[];
}

export interface CompiledSceneSummary {
    commandCount: number;
    dependencies: CompiledAssetDependencies;
    localeNamespace?: string;
    nextScenes?: string[];
    schemaVersion?: 1 | 2;
}

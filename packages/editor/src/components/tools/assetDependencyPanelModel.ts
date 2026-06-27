import type { AssetDependencyGraph, AssetUsageEntry } from '../../services/referenceScanner';

import { AUDIO_EXT, FONT_EXT, getExtension, IMG_EXT, TEXT_EXT } from '../../utils/assetTypes';

export type AssetLibraryKind =
    | 'audio'
    | 'font'
    | 'image'
    | 'json'
    | 'other'
    | 'text';

export type AssetLibraryKindFilter = 'all' | AssetLibraryKind;

export type AssetLibraryKindSummary = {
    kind: AssetLibraryKind;
    missing: number;
    total: number;
    unused: number;
    used: number;
};

export type UnusedAssetFolderGroup = {
    assetUrls: string[];
    folder: string;
};

export function areAllUnusedAssetsSelected(
    selectedAssetUrls: readonly string[],
    unusedAssetUrls: readonly string[],
): boolean {
    if (unusedAssetUrls.length === 0) return false;
    const selected = new Set(selectedAssetUrls);
    return unusedAssetUrls.every((assetUrl) => selected.has(assetUrl));
}

export function classifyAssetLibraryKind(assetUrl: string): AssetLibraryKind {
    const extension = getExtension(assetUrl);
    if (IMG_EXT.has(extension)) return 'image';
    if (AUDIO_EXT.has(extension)) return 'audio';
    if (FONT_EXT.has(extension)) return 'font';
    if (extension === '.json') return 'json';
    if (TEXT_EXT.has(extension)) return 'text';
    return 'other';
}

export function createAssetKindSummary(dependencyGraph: AssetDependencyGraph): AssetLibraryKindSummary[] {
    const summaries = new Map<AssetLibraryKind, AssetLibraryKindSummary>();

    for (const entry of dependencyGraph.used) {
        getAssetKindSummary(summaries, classifyAssetLibraryKind(entry.assetUrl)).used += 1;
    }

    for (const assetUrl of dependencyGraph.unused) {
        getAssetKindSummary(summaries, classifyAssetLibraryKind(assetUrl)).unused += 1;
    }

    for (const entry of dependencyGraph.missing) {
        getAssetKindSummary(summaries, classifyAssetLibraryKind(entry.assetUrl)).missing += 1;
    }

    return [...summaries.values()]
        .map((summary) => ({
            ...summary,
            total: summary.used + summary.unused + summary.missing,
        }))
        .toSorted((left, right) => (
            ASSET_KIND_ORDER.indexOf(left.kind) - ASSET_KIND_ORDER.indexOf(right.kind)
        ));
}

export function filterAssetDependencyGraph(
    dependencyGraph: AssetDependencyGraph,
    query: string,
    kindFilter: AssetLibraryKindFilter = 'all',
): AssetDependencyGraph {
    const normalizedQuery = normalizeAssetSearchQuery(query);
    if (!normalizedQuery && kindFilter === 'all') {
        return {
            missing: [...dependencyGraph.missing],
            unused: [...dependencyGraph.unused],
            used: [...dependencyGraph.used],
        };
    }

    return {
        missing: dependencyGraph.missing.filter((entry) => assetUsageEntryMatches(entry, normalizedQuery, kindFilter)),
        unused: dependencyGraph.unused.filter((assetUrl) => assetUrlMatches(assetUrl, normalizedQuery, kindFilter)),
        used: dependencyGraph.used.filter((entry) => assetUsageEntryMatches(entry, normalizedQuery, kindFilter)),
    };
}

export function getSelectedUnusedAssets(
    selectedAssetUrls: readonly string[],
    unusedAssetUrls: readonly string[],
): string[] {
    const selected = new Set(selectedAssetUrls);
    return unusedAssetUrls.filter((assetUrl) => selected.has(assetUrl));
}

export function groupUnusedAssetsByFolder(unusedAssetUrls: readonly string[]): UnusedAssetFolderGroup[] {
    const groups = new Map<string, string[]>();

    for (const assetUrl of unusedAssetUrls) {
        const folder = getAssetFolder(assetUrl);
        groups.set(folder, [...(groups.get(folder) ?? []), assetUrl]);
    }

    return [...groups.entries()]
        .map(([folder, assetUrls]) => ({
            assetUrls: assetUrls.toSorted((left, right) => left.localeCompare(right)),
            folder,
        }))
        .toSorted((left, right) => left.folder.localeCompare(right.folder));
}

export function projectRelativeAssetPathFromUrl(assetUrl: string): string | undefined {
    const normalized = assetUrl.trim().replaceAll('\\', '/').replace(/^\/+/u, '');
    if (!normalized.startsWith('assets/')) return;
    return normalized;
}

const ASSET_KIND_ORDER: AssetLibraryKind[] = ['image', 'audio', 'json', 'font', 'text', 'other'];

export function reconcileUnusedAssetSelection(
    selectedAssetUrls: readonly string[],
    unusedAssetUrls: readonly string[],
): string[] {
    const selected = getSelectedUnusedAssets(selectedAssetUrls, unusedAssetUrls);
    if (selected.length > 0 || selectedAssetUrls.length > 0) return selected;
    return [...unusedAssetUrls];
}

export function removeUnusedAssetScope(
    selectedAssetUrls: readonly string[],
    scopedAssetUrls: readonly string[],
): string[] {
    const scoped = new Set(scopedAssetUrls);
    return selectedAssetUrls
        .filter((assetUrl) => !scoped.has(assetUrl))
        .toSorted((left, right) => left.localeCompare(right));
}

export function selectUnusedAssetScope(
    selectedAssetUrls: readonly string[],
    scopedAssetUrls: readonly string[],
): string[] {
    return [...new Set([...selectedAssetUrls, ...scopedAssetUrls])]
        .toSorted((left, right) => left.localeCompare(right));
}

export function toggleUnusedAssetSelection(
    selectedAssetUrls: readonly string[],
    assetUrl: string,
    selected: boolean,
): string[] {
    const next = new Set(selectedAssetUrls);
    if (selected) {
        next.add(assetUrl);
    } else {
        next.delete(assetUrl);
    }
    return [...next].toSorted((left, right) => left.localeCompare(right));
}

function assetUrlMatches(assetUrl: string, normalizedQuery: string, kindFilter: AssetLibraryKindFilter): boolean {
    if (kindFilter !== 'all' && classifyAssetLibraryKind(assetUrl) !== kindFilter) return false;
    return normalizedAssetSearchText(assetUrl).includes(normalizedQuery);
}

function assetUsageEntryMatches(
    entry: AssetUsageEntry,
    normalizedQuery: string,
    kindFilter: AssetLibraryKindFilter,
): boolean {
    if (kindFilter !== 'all' && classifyAssetLibraryKind(entry.assetUrl) !== kindFilter) return false;

    return assetUrlMatches(entry.assetUrl, normalizedQuery, kindFilter)
        || entry.references.some((reference) => [
            reference.commandType,
            reference.filePath,
            reference.path.join('.'),
            reference.sceneName,
        ].some((value) => normalizedAssetSearchText(value).includes(normalizedQuery)));
}

function getAssetFolder(assetUrl: string): string {
    const normalized = assetUrl.trim().replaceAll('\\', '/').replace(/^\/+/u, '');
    const separatorIndex = normalized.lastIndexOf('/');
    if (separatorIndex <= 0) return 'assets';
    return normalized.slice(0, separatorIndex);
}

function getAssetKindSummary(
    summaries: Map<AssetLibraryKind, AssetLibraryKindSummary>,
    kind: AssetLibraryKind,
): AssetLibraryKindSummary {
    const existing = summaries.get(kind);
    if (existing) return existing;

    const summary = {
        kind,
        missing: 0,
        total: 0,
        unused: 0,
        used: 0,
    };
    summaries.set(kind, summary);
    return summary;
}

function normalizeAssetSearchQuery(query: string): string {
    return normalizedAssetSearchText(query).trim();
}

function normalizedAssetSearchText(value: string): string {
    return value.replaceAll('\\', '/').toLocaleLowerCase();
}

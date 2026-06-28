import type { AssetDependencyGraph, AssetUsageEntry } from '../../services/referenceScanner';

import {
    addAssetLibraryMetadataToAssets,
    type AssetLibraryMetadata,
} from '../../services/assetLibraryMetadata';
import { classifyAssetLibraryKind } from './assetDependencyPanelModel';

export type AssetLibraryAudioRole =
    | 'audio-region'
    | 'audiosheet'
    | 'bgm'
    | 'other'
    | 'sfx'
    | 'voice';

export type AssetLibraryAudioRoleFilter = 'all' | AssetLibraryAudioRole;

export type AssetLibraryAudioRoleSummary = {
    missing: number;
    role: AssetLibraryAudioRole;
    total: number;
    unused: number;
    used: number;
};

export type AssetAudioRoleAssetGroup = {
    assetUrls: string[];
    label: string;
    role: AssetLibraryAudioRole;
};

export type AssetAudioRoleMetadataApplyResult = {
    assetCount: number;
    metadata: AssetLibraryMetadata;
    roleGroups: AssetAudioRoleAssetGroup[];
};

export function applyAssetAudioRoleMetadataToLibrary(
    metadata: AssetLibraryMetadata,
    roleGroups: readonly AssetAudioRoleAssetGroup[],
): AssetAudioRoleMetadataApplyResult {
    let nextMetadata = metadata;
    let assetCount = 0;

    for (const group of roleGroups) {
        if (group.assetUrls.length === 0) continue;
        assetCount += group.assetUrls.length;
        nextMetadata = addAssetLibraryMetadataToAssets(nextMetadata, group.assetUrls, {
            collections: ['Audio'],
            tags: [group.label],
        });
    }

    return {
        assetCount,
        metadata: nextMetadata,
        roleGroups: roleGroups.map((group) => ({
            ...group,
            assetUrls: [...group.assetUrls],
        })),
    };
}

export function classifyAssetLibraryAudioRole(
    assetUrl: string,
    references: readonly AssetUsageEntry['references'][number][] = [],
): AssetLibraryAudioRole | undefined {
    if (!isAudioLibraryAsset(assetUrl)) return undefined;

    const commandRole = references
        .map((reference) => audioRoleFromText(reference.commandType))
        .find((role) => role !== undefined);
    if (commandRole) return commandRole;

    if (normalizedAssetSearchText(assetUrl).includes('/audio-regions/')) return 'audio-region';
    if (assetUrl.toLocaleLowerCase().endsWith('.sheet.json')) return 'audiosheet';

    return audioRoleFromText(assetUrl) ?? 'other';
}

export function collectAssetAudioRoleAssetGroups(dependencyGraph: AssetDependencyGraph): AssetAudioRoleAssetGroup[] {
    const rolesByAssetUrl = new Map<string, AssetLibraryAudioRole>();

    for (const entry of dependencyGraph.missing) {
        upsertAudioAssetRole(rolesByAssetUrl, entry.assetUrl, classifyAssetLibraryAudioRole(entry.assetUrl, entry.references));
    }
    for (const entry of dependencyGraph.used) {
        upsertAudioAssetRole(rolesByAssetUrl, entry.assetUrl, classifyAssetLibraryAudioRole(entry.assetUrl, entry.references));
    }
    for (const assetUrl of dependencyGraph.unused) {
        upsertAudioAssetRole(rolesByAssetUrl, assetUrl, classifyAssetLibraryAudioRole(assetUrl));
    }

    return ASSET_AUDIO_ROLE_ORDER
        .map((role) => ({
            assetUrls: [...rolesByAssetUrl.entries()]
                .filter(([, assetRole]) => assetRole === role)
                .map(([assetUrl]) => assetUrl)
                .toSorted((left, right) => left.localeCompare(right)),
            label: formatAssetAudioRole(role),
            role,
        }))
        .filter((group) => group.assetUrls.length > 0);
}

export function createAssetAudioRoleSummary(dependencyGraph: AssetDependencyGraph): AssetLibraryAudioRoleSummary[] {
    const summaries = new Map<AssetLibraryAudioRole, AssetLibraryAudioRoleSummary>();

    for (const entry of dependencyGraph.used) {
        const role = classifyAssetLibraryAudioRole(entry.assetUrl, entry.references);
        if (role) getAssetAudioRoleSummary(summaries, role).used += 1;
    }

    for (const assetUrl of dependencyGraph.unused) {
        const role = classifyAssetLibraryAudioRole(assetUrl);
        if (role) getAssetAudioRoleSummary(summaries, role).unused += 1;
    }

    for (const entry of dependencyGraph.missing) {
        const role = classifyAssetLibraryAudioRole(entry.assetUrl, entry.references);
        if (role) getAssetAudioRoleSummary(summaries, role).missing += 1;
    }

    return [...summaries.values()]
        .map((summary) => ({
            ...summary,
            total: summary.used + summary.unused + summary.missing,
        }))
        .toSorted((left, right) => (
            ASSET_AUDIO_ROLE_ORDER.indexOf(left.role) - ASSET_AUDIO_ROLE_ORDER.indexOf(right.role)
        ));
}

export function filterAssetDependencyGraphByAudioRole(
    dependencyGraph: AssetDependencyGraph,
    roleFilter: AssetLibraryAudioRoleFilter,
): AssetDependencyGraph {
    if (roleFilter === 'all') {
        return {
            missing: [...dependencyGraph.missing],
            unused: [...dependencyGraph.unused],
            used: [...dependencyGraph.used],
        };
    }

    return {
        missing: dependencyGraph.missing.filter((entry) => classifyAssetLibraryAudioRole(entry.assetUrl, entry.references) === roleFilter),
        unused: dependencyGraph.unused.filter((assetUrl) => classifyAssetLibraryAudioRole(assetUrl) === roleFilter),
        used: dependencyGraph.used.filter((entry) => classifyAssetLibraryAudioRole(entry.assetUrl, entry.references) === roleFilter),
    };
}

export function formatAssetAudioRole(role: AssetLibraryAudioRole): string {
    switch (role) {
        case 'audio-region': return 'Audio Region';
        case 'audiosheet': return 'Audiosheet';
        case 'bgm': return 'BGM';
        case 'other': return 'Other Audio';
        case 'sfx': return 'SFX';
        case 'voice': return 'Voice';
    }
}

const ASSET_AUDIO_ROLE_ORDER: AssetLibraryAudioRole[] = ['bgm', 'sfx', 'voice', 'audio-region', 'audiosheet', 'other'];

function audioRoleFromText(value: string): AssetLibraryAudioRole | undefined {
    const normalized = normalizedAssetSearchText(value);
    if (/(^|[\/_.-])(bgm|music|song|theme|loop)([\/_.-]|$)/u.test(normalized)) return 'bgm';
    if (/(^|[\/_.-])(sfx|sound|effect|click|beep)([\/_.-]|$)/u.test(normalized)) return 'sfx';
    if (/(^|[\/_.-])(voice|vo|dialogue|line)([\/_.-]|$)/u.test(normalized)) return 'voice';
    return undefined;
}

function getAssetAudioRoleSummary(
    summaries: Map<AssetLibraryAudioRole, AssetLibraryAudioRoleSummary>,
    role: AssetLibraryAudioRole,
): AssetLibraryAudioRoleSummary {
    const existing = summaries.get(role);
    if (existing) return existing;

    const summary = {
        missing: 0,
        role,
        total: 0,
        unused: 0,
        used: 0,
    };
    summaries.set(role, summary);
    return summary;
}

function isAudioLibraryAsset(assetUrl: string): boolean {
    return classifyAssetLibraryKind(assetUrl) === 'audio'
        || assetUrl.toLocaleLowerCase().endsWith('.sheet.json');
}

function normalizedAssetSearchText(value: string): string {
    return value.replaceAll('\\', '/').toLocaleLowerCase();
}

function upsertAudioAssetRole(
    rolesByAssetUrl: Map<string, AssetLibraryAudioRole>,
    assetUrl: string,
    role: AssetLibraryAudioRole | undefined,
): void {
    if (!role) return;

    const current = rolesByAssetUrl.get(assetUrl);
    if (!current || current === 'other') {
        rolesByAssetUrl.set(assetUrl, role);
    }
}

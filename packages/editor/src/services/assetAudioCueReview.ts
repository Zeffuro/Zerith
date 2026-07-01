import type { AudiosheetDescriptor } from 'core/types';

import { parseAudiosheetDescriptor } from 'core/schemas';

import { detectDescriptorType } from '../utils/assetDescriptorUtilities';
import { fsJoin, fsReadTextFile } from './fs';

export type AssetAudioCueExportReadiness = {
    blockedEntryCount: number;
    detailMessages: string[];
    exportableCueCount: number;
    exportableEntryCount: number;
    issueEntryCount: number;
    message: string;
    missingSourceEntryCount: number;
    openEndedCueCount: number;
    status: AssetAudioCueExportReadinessStatus;
    totalEntryCount: number;
};

export type AssetAudioCueExportReadinessStatus = 'blocked' | 'limited' | 'ready';

export type AssetAudioCueReview = {
    entries: AssetAudioCueReviewEntry[];
    issueCount: number;
    totalCues: number;
};

export type AssetAudioCueReviewDependencies = {
    join: (...parts: string[]) => Promise<string>;
    readTextFile: (path: string) => Promise<string>;
};

export type AssetAudioCueReviewEntry = {
    cueCount: number;
    cueNames: string[];
    descriptorAssetUrl: string;
    finiteDurationSeconds: number;
    issueMessages: string[];
    loopCueCount: number;
    openEndedCueCount: number;
    sourceAssetUrl?: string;
    sourceAvailable?: boolean;
    volumeOverrideCueCount: number;
};

export type AssetAudioCueReviewFilter = 'all' | 'exportable' | 'issues' | 'missing-source';

export type AssetAudioCueReviewSummary = {
    exportableCueCount: number;
    exportableEntryCount: number;
    issueEntryCount: number;
    missingSourceEntryCount: number;
    totalCueCount: number;
    totalEntryCount: number;
};

const defaultDependencies: AssetAudioCueReviewDependencies = {
    join: fsJoin,
    readTextFile: fsReadTextFile,
};

export function collectAssetAudioCueOrganizationAssetUrls(
    entries: readonly AssetAudioCueReviewEntry[],
): string[] {
    const assetUrls = new Set<string>();
    for (const entry of entries) {
        assetUrls.add(entry.descriptorAssetUrl);
        if (entry.sourceAssetUrl && entry.sourceAvailable !== false) {
            assetUrls.add(entry.sourceAssetUrl);
        }
    }
    return [...assetUrls].toSorted((left, right) => left.localeCompare(right));
}

export function createAssetAudioCueExportReadiness(
    entries: readonly AssetAudioCueReviewEntry[],
): AssetAudioCueExportReadiness {
    const summary = createAssetAudioCueReviewSummary(entries);
    const blockedEntryCount = entries.filter((entry) => !isAssetAudioCueReviewEntryExportable(entry)).length;
    const openEndedCueCount = entries.reduce((total, entry) => total + entry.openEndedCueCount, 0);
    const detailMessages = [
        summary.missingSourceEntryCount > 0
            ? `${summary.missingSourceEntryCount} ${pluralize(summary.missingSourceEntryCount, 'sheet')} missing source audio.`
            : undefined,
        openEndedCueCount > 0
            ? `${openEndedCueCount} open-ended ${pluralize(openEndedCueCount, 'cue')} will use source duration during export.`
            : undefined,
        blockedEntryCount > 0 && summary.exportableEntryCount > 0
            ? `${blockedEntryCount} visible ${pluralize(blockedEntryCount, 'sheet')} will be skipped.`
            : undefined,
    ].filter((message): message is string => message !== undefined);

    if (summary.totalEntryCount === 0) {
        return {
            blockedEntryCount,
            detailMessages,
            exportableCueCount: 0,
            exportableEntryCount: 0,
            issueEntryCount: 0,
            message: 'No visible cue sheets to export.',
            missingSourceEntryCount: 0,
            openEndedCueCount: 0,
            status: 'blocked',
            totalEntryCount: 0,
        };
    }

    if (summary.exportableEntryCount === 0) {
        return {
            blockedEntryCount,
            detailMessages,
            exportableCueCount: 0,
            exportableEntryCount: 0,
            issueEntryCount: summary.issueEntryCount,
            message: summary.missingSourceEntryCount > 0
                ? `${summary.missingSourceEntryCount} visible ${pluralize(summary.missingSourceEntryCount, 'sheet')} missing source audio.`
                : 'No visible cue sheets have exportable cues.',
            missingSourceEntryCount: summary.missingSourceEntryCount,
            openEndedCueCount,
            status: 'blocked',
            totalEntryCount: summary.totalEntryCount,
        };
    }

    const baseMessage = `${summary.exportableCueCount} cue WAV${summary.exportableCueCount === 1 ? '' : 's'} ready from ${summary.exportableEntryCount} ${pluralize(summary.exportableEntryCount, 'sheet')}.`;
    const status: AssetAudioCueExportReadinessStatus = blockedEntryCount > 0 || summary.issueEntryCount > 0
        ? 'limited'
        : 'ready';

    return {
        blockedEntryCount,
        detailMessages,
        exportableCueCount: summary.exportableCueCount,
        exportableEntryCount: summary.exportableEntryCount,
        issueEntryCount: summary.issueEntryCount,
        message: status === 'limited' ? `${baseMessage} Review issues before export.` : baseMessage,
        missingSourceEntryCount: summary.missingSourceEntryCount,
        openEndedCueCount,
        status,
        totalEntryCount: summary.totalEntryCount,
    };
}

export function createAssetAudioCueReviewEntry(
    descriptorAssetUrl: string,
    descriptor: AudiosheetDescriptor,
    assetInventory: readonly string[],
): AssetAudioCueReviewEntry {
    const inventory = new Set(assetInventory);
    const cueEntries = Object.entries(descriptor.cues)
        .toSorted(([left], [right]) => left.localeCompare(right));
    const cueNames = cueEntries.map(([cueName]) => cueName);
    const issueMessages: string[] = [];
    let finiteDurationSeconds = 0;
    let loopCueCount = 0;
    let openEndedCueCount = 0;
    let volumeOverrideCueCount = 0;

    for (const [cueName, cue] of cueEntries) {
        if (cue.loop) loopCueCount += 1;
        if (cue.volume !== undefined) volumeOverrideCueCount += 1;
        if (cue.duration === undefined) {
            openEndedCueCount += 1;
            issueMessages.push(`Cue "${cueName}" has no duration.`);
        } else {
            finiteDurationSeconds += cue.duration;
        }
    }

    if (cueEntries.length === 0) {
        issueMessages.push('No cues defined.');
    }

    const sourceAssetUrl = resolveAudiosheetSourceAssetUrl(descriptorAssetUrl, descriptor.source);
    const sourceAvailable = sourceAssetUrl === undefined ? undefined : inventory.has(sourceAssetUrl);
    if (sourceAssetUrl && sourceAvailable === false) {
        issueMessages.push(`Source audio missing: ${sourceAssetUrl}`);
    }

    return {
        cueCount: cueEntries.length,
        cueNames,
        descriptorAssetUrl,
        finiteDurationSeconds,
        issueMessages,
        loopCueCount,
        openEndedCueCount,
        sourceAssetUrl,
        sourceAvailable,
        volumeOverrideCueCount,
    };
}

export function createAssetAudioCueReviewSummary(
    entries: readonly AssetAudioCueReviewEntry[],
): AssetAudioCueReviewSummary {
    let exportableCueCount = 0;
    let exportableEntryCount = 0;
    let issueEntryCount = 0;
    let missingSourceEntryCount = 0;
    let totalCueCount = 0;

    for (const entry of entries) {
        totalCueCount += entry.cueCount;
        if (isAssetAudioCueReviewEntryExportable(entry)) {
            exportableEntryCount += 1;
            exportableCueCount += entry.cueCount;
        }
        if (entry.issueMessages.length > 0) issueEntryCount += 1;
        if (entry.sourceAvailable === false) missingSourceEntryCount += 1;
    }

    return {
        exportableCueCount,
        exportableEntryCount,
        issueEntryCount,
        missingSourceEntryCount,
        totalCueCount,
        totalEntryCount: entries.length,
    };
}

export function filterAssetAudioCueReviewEntries(
    entries: readonly AssetAudioCueReviewEntry[],
    filter: AssetAudioCueReviewFilter,
): AssetAudioCueReviewEntry[] {
    switch (filter) {
        case 'all': {
            return [...entries];
        }
        case 'exportable': {
            return entries.filter((entry) => isAssetAudioCueReviewEntryExportable(entry));
        }
        case 'issues': {
            return entries.filter((entry) => entry.issueMessages.length > 0);
        }
        case 'missing-source': {
            return entries.filter((entry) => entry.sourceAvailable === false);
        }
    }
}

export function isAssetAudioCueReviewEntryExportable(entry: AssetAudioCueReviewEntry): boolean {
    return entry.cueCount > 0 && entry.sourceAvailable !== false;
}

export async function loadAssetAudioCueReview(
    projectPath: string,
    assetUrls: readonly string[],
    assetInventory: readonly string[],
    dependencies: AssetAudioCueReviewDependencies = defaultDependencies,
): Promise<AssetAudioCueReview> {
    const descriptorAssetUrls = [...new Set(assetUrls)]
        .filter((assetUrl) => isSheetDescriptorAssetUrl(assetUrl))
        .toSorted((left, right) => left.localeCompare(right));
    const entries: AssetAudioCueReviewEntry[] = [];

    for (const descriptorAssetUrl of descriptorAssetUrls) {
        const entry = await readCueReviewEntry(projectPath, descriptorAssetUrl, assetInventory, dependencies);
        if (entry) entries.push(entry);
    }

    return {
        entries,
        issueCount: entries.reduce((total, entry) => total + entry.issueMessages.length, 0),
        totalCues: entries.reduce((total, entry) => total + entry.cueCount, 0),
    };
}

export function resolveAudiosheetSourceAssetUrl(
    descriptorAssetUrl: string,
    source: string,
): string | undefined {
    if (/^[a-z]+:\/\//iu.test(source)) return undefined;

    if (source.startsWith('/assets/')) return normalizeAssetUrl(source);
    if (source.startsWith('assets/')) return normalizeAssetUrl(`/${source}`);

    const baseSegments = descriptorAssetUrl.replaceAll('\\', '/').split('/');
    baseSegments.pop();

    for (const segment of source.replaceAll('\\', '/').split('/')) {
        if (!segment || segment === '.') continue;
        if (segment === '..') {
            if (baseSegments.length > 1) baseSegments.pop();
            continue;
        }
        baseSegments.push(segment);
    }

    return normalizeAssetUrl(baseSegments.join('/'));
}

export function searchAssetAudioCueReviewEntries(
    entries: readonly AssetAudioCueReviewEntry[],
    query: string,
): AssetAudioCueReviewEntry[] {
    const terms = query
        .trim()
        .toLocaleLowerCase()
        .split(/\s+/u)
        .filter(Boolean);
    if (terms.length === 0) return [...entries];

    return entries.filter((entry) => {
        const haystack = [
            entry.descriptorAssetUrl,
            entry.sourceAssetUrl,
            ...entry.cueNames,
            ...entry.issueMessages,
        ]
            .filter((value): value is string => typeof value === 'string')
            .join('\n')
            .toLocaleLowerCase();

        return terms.every((term) => haystack.includes(term));
    });
}

function createIssueEntry(descriptorAssetUrl: string, issueMessage: string): AssetAudioCueReviewEntry {
    return {
        cueCount: 0,
        cueNames: [],
        descriptorAssetUrl,
        finiteDurationSeconds: 0,
        issueMessages: [issueMessage],
        loopCueCount: 0,
        openEndedCueCount: 0,
        volumeOverrideCueCount: 0,
    };
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function isSheetDescriptorAssetUrl(assetUrl: string): boolean {
    return assetUrl.toLocaleLowerCase().endsWith('.sheet.json');
}

function normalizeAssetUrl(assetUrl: string): string | undefined {
    const normalized = assetUrl.replaceAll('\\', '/').replaceAll(/\/+/gu, '/');
    const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`;
    return withLeadingSlash.startsWith('/assets/') ? withLeadingSlash : undefined;
}

function pluralize(count: number, singular: string): string {
    return count === 1 ? singular : `${singular}s`;
}

async function readCueReviewEntry(
    projectPath: string,
    descriptorAssetUrl: string,
    assetInventory: readonly string[],
    dependencies: AssetAudioCueReviewDependencies,
): Promise<AssetAudioCueReviewEntry | undefined> {
    const descriptorPath = await dependencies.join(projectPath, descriptorAssetUrl.replace(/^\/+/u, ''));

    let raw: string;
    try {
        raw = await dependencies.readTextFile(descriptorPath);
    } catch (error) {
        return createIssueEntry(descriptorAssetUrl, `Descriptor unreadable: ${errorMessage(error)}`);
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch (error) {
        return createIssueEntry(descriptorAssetUrl, `Descriptor JSON invalid: ${errorMessage(error)}`);
    }

    if (detectDescriptorType(parsed) !== 'audiosheet') return undefined;

    const descriptor = parseAudiosheetDescriptor(parsed);
    if (!descriptor.success) {
        return createIssueEntry(descriptorAssetUrl, `Invalid audiosheet: ${descriptor.error}`);
    }

    return createAssetAudioCueReviewEntry(descriptorAssetUrl, descriptor.data, assetInventory);
}

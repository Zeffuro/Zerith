import { parseAudiosheetDescriptor } from 'core/schemas';

import type { AudiosheetDescriptor } from 'core/types';

import { detectDescriptorType } from '../utils/assetDescriptorUtilities';
import { fsJoin, fsReadTextFile } from './fs';

export type AssetAudioCueReview = {
    entries: AssetAudioCueReviewEntry[];
    issueCount: number;
    totalCues: number;
};

export type AssetAudioCueReviewEntry = {
    cueCount: number;
    descriptorAssetUrl: string;
    finiteDurationSeconds: number;
    issueMessages: string[];
    loopCueCount: number;
    openEndedCueCount: number;
    sourceAssetUrl?: string;
    sourceAvailable?: boolean;
    volumeOverrideCueCount: number;
};

export type AssetAudioCueReviewDependencies = {
    join: (...parts: string[]) => Promise<string>;
    readTextFile: (path: string) => Promise<string>;
};

const defaultDependencies: AssetAudioCueReviewDependencies = {
    join: fsJoin,
    readTextFile: fsReadTextFile,
};

export function createAssetAudioCueReviewEntry(
    descriptorAssetUrl: string,
    descriptor: AudiosheetDescriptor,
    assetInventory: readonly string[],
): AssetAudioCueReviewEntry {
    const inventory = new Set(assetInventory);
    const cueEntries = Object.entries(descriptor.cues);
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

export async function loadAssetAudioCueReview(
    projectPath: string,
    assetUrls: readonly string[],
    assetInventory: readonly string[],
    dependencies: AssetAudioCueReviewDependencies = defaultDependencies,
): Promise<AssetAudioCueReview> {
    const descriptorAssetUrls = [...new Set(assetUrls)]
        .filter(isSheetDescriptorAssetUrl)
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

function createIssueEntry(descriptorAssetUrl: string, issueMessage: string): AssetAudioCueReviewEntry {
    return {
        cueCount: 0,
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

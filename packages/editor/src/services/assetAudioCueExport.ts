import type { AudiosheetDescriptor } from 'core/types';

import { parseAudiosheetDescriptor } from 'core/schemas';

import type { AudioBufferLike, AudioRegion, AudioRegionBatchNamePreset } from '../utils/audioRegions';
import type { SaveAudioRegionInput, SaveAudioRegionResult } from './audioRegionExport';

import { detectDescriptorType } from '../utils/assetDescriptorUtilities';
import { closeAudioContext, decodeAudioSource } from '../utils/audio';
import { encodeAudioBufferRegionsToWavFiles } from '../utils/audioRegions';
import { saveAudioRegionWavToProject } from './audioRegionExport';
import { fsDirname, fsJoin, fsReadTextFile } from './fs';

export type AssetAudioCueExportDependencies = {
    decodeAudioSource: (path: string) => Promise<AudioBufferLike>;
    dirname: (path: string) => Promise<string>;
    join: (...parts: string[]) => Promise<string>;
    readTextFile: (path: string) => Promise<string>;
    saveRegion: (
        projectPath: string,
        input: SaveAudioRegionInput,
    ) => Promise<SaveAudioRegionResult>;
};

export type AssetAudioCueExportOptions = {
    descriptorAssetUrl: string;
    namePreset?: AudioRegionBatchNamePreset;
    targetFolder?: string;
};

export type AssetAudioCueExportResult = {
    assetUrls: string[];
    descriptorAssetUrl: string;
    exportedCount: number;
    sourcePath: string;
    targetFolder: string;
};

const DEFAULT_TARGET_FOLDER = 'assets/audio-regions';

export function createAudiosheetCueExportRegions(
    descriptor: AudiosheetDescriptor,
    audioDuration: number,
): AudioRegion[] {
    return Object.entries(descriptor.cues)
        .toSorted(([leftName], [rightName]) => leftName.localeCompare(rightName))
        .map(([name, cue]) => {
            const start = Math.max(0, cue.start);
            const duration = cue.duration ?? Math.max(0.01, audioDuration - start);
            return {
                end: start + Math.max(0.01, duration),
                name,
                start,
            };
        });
}

export async function exportAssetAudioCuesToProject(
    projectPath: string,
    options: AssetAudioCueExportOptions,
    dependencies: Partial<AssetAudioCueExportDependencies> = {},
): Promise<AssetAudioCueExportResult> {
    const deps = createDependencies(dependencies);
    const descriptorPath = await resolveProjectAssetPath(projectPath, options.descriptorAssetUrl, deps);
    const descriptor = await readAudiosheetDescriptor(descriptorPath, deps);
    const sourcePath = await resolveAudiosheetAudioPath(descriptorPath, descriptor.source, deps);
    const audioBuffer = await deps.decodeAudioSource(sourcePath);
    const regions = createAudiosheetCueExportRegions(descriptor, audioBuffer.duration);
    const targetFolder = options.targetFolder ?? DEFAULT_TARGET_FOLDER;

    if (regions.length === 0) {
        return {
            assetUrls: [],
            descriptorAssetUrl: options.descriptorAssetUrl,
            exportedCount: 0,
            sourcePath,
            targetFolder,
        };
    }

    const encoded = encodeAudioBufferRegionsToWavFiles(audioBuffer, sourcePath, regions, {
        namePreset: options.namePreset ?? 'region-name-time',
    });
    const saved: SaveAudioRegionResult[] = [];

    for (const entry of encoded) {
        const region: AudioRegion = {
            end: entry.region.end,
            ...(entry.regionName === undefined ? {} : { name: entry.regionName }),
            start: entry.region.start,
        };
        const result = await deps.saveRegion(projectPath, {
            namePreset: options.namePreset ?? 'region-name-time',
            region,
            sourcePath,
            targetFolder,
            wavBytes: entry.wavBytes,
        });
        saved.push(result);
    }

    return {
        assetUrls: saved.map((result) => result.assetUrl),
        descriptorAssetUrl: options.descriptorAssetUrl,
        exportedCount: saved.length,
        sourcePath,
        targetFolder,
    };
}

export async function resolveAudiosheetAudioPath(
    descriptorPath: string,
    source: string,
    dependencies: Pick<AssetAudioCueExportDependencies, 'dirname' | 'join'>,
): Promise<string> {
    if (/^(?:https?:|data:|blob:|file:|asset:)/iu.test(source)) return source;
    if (/^[a-z]:[\\/]/iu.test(source) || source.startsWith('/')) return source;
    const parent = await dependencies.dirname(descriptorPath);
    const joined = await dependencies.join(parent, source);
    return normalizePathSegments(joined);
}

function createDependencies(
    dependencies: Partial<AssetAudioCueExportDependencies>,
): AssetAudioCueExportDependencies {
    return {
        decodeAudioSource: dependencies.decodeAudioSource ?? decodeWithTemporaryContext,
        dirname: dependencies.dirname ?? fsDirname,
        join: dependencies.join ?? fsJoin,
        readTextFile: dependencies.readTextFile ?? fsReadTextFile,
        saveRegion: dependencies.saveRegion ?? saveAudioRegionWavToProject,
    };
}

async function decodeWithTemporaryContext(path: string): Promise<AudioBufferLike> {
    const reference = { current: undefined as AudioContext | undefined };
    try {
        return await decodeAudioSource(path, reference);
    } finally {
        await closeAudioContext(reference);
    }
}

function normalizePathSegments(path: string): string {
    const normalized = path.replaceAll('\\', '/');
    const prefixMatch = normalized.match(/^[a-z]:/iu);
    const prefix = prefixMatch?.[0] ?? (normalized.startsWith('/') ? '/' : '');
    const rest = prefixMatch ? normalized.slice(prefix.length) : normalized.slice(prefix.length);
    const segments: string[] = [];

    for (const segment of rest.split('/')) {
        if (!segment || segment === '.') continue;
        if (segment === '..') {
            if (segments.length > 0) segments.pop();
            continue;
        }
        segments.push(segment);
    }

    if (prefixMatch) return `${prefix}/${segments.join('/')}`;
    return `${prefix}${segments.join('/')}` || '.';
}

async function readAudiosheetDescriptor(
    descriptorPath: string,
    dependencies: Pick<AssetAudioCueExportDependencies, 'readTextFile'>,
): Promise<AudiosheetDescriptor> {
    const raw = await dependencies.readTextFile(descriptorPath);
    const parsed: unknown = JSON.parse(raw);
    if (detectDescriptorType(parsed) !== 'audiosheet') {
        throw new Error('Selected asset is not an audiosheet descriptor.');
    }

    const result = parseAudiosheetDescriptor(parsed);
    if (!result.success) {
        throw new Error(result.error);
    }
    return result.data;
}

async function resolveProjectAssetPath(
    projectPath: string,
    assetUrl: string,
    dependencies: Pick<AssetAudioCueExportDependencies, 'join'>,
): Promise<string> {
    const relativeAssetPath = assetUrl.replaceAll('\\', '/').replace(/^\/+/u, '');
    return dependencies.join(projectPath, relativeAssetPath);
}

import { clamp } from './math';

export type AudioBufferLike = {
    duration: number;
    getChannelData: (channel: number) => Float32Array;
    length: number;
    numberOfChannels: number;
    sampleRate: number;
};

export type AudioRegion = {
    end: number;
    name?: string;
    start: number;
};

export type AudioRegionBatchExportEntry = {
    collisionResolved: boolean;
    fileName: string;
    region: NormalizedAudioRegion;
    regionName?: string;
    sourceIndex: number;
};

export type AudioRegionBatchExportOptions = {
    audioDuration?: number;
    existingFileNames?: Iterable<string>;
    namePreset?: AudioRegionBatchNamePreset;
};

export type AudioRegionBatchNamePreset = 'region-name-time' | 'source-time';

export type AudioRegionBatchWavExport = {
    wavBytes: Uint8Array;
} & AudioRegionBatchExportEntry;

export type AudioRegionBatchWavExportOptions = AudioRegionBatchExportOptions & AudioRegionExportOptions;

export type AudioRegionExportOptions = {
    bitDepth?: 16;
};

export type NormalizedAudioRegion = {
    duration: number;
    end: number;
    start: number;
};

export type ProjectedAudioRegion = {
    end: number;
    name?: string;
    sourceEnd: number;
    sourceStart: number;
    start: number;
};

export type RegionViewport = {
    duration: number;
    start: number;
};

const MIN_REGION_DURATION_SECONDS = 0.01;

export function createAudioRegionBatchExportPlan(
    sourcePath: string,
    regions: readonly AudioRegion[],
    options: AudioRegionBatchExportOptions = {},
): AudioRegionBatchExportEntry[] {
    const usedFileNames = new Set<string>();
    for (const existingFileName of options.existingFileNames ?? []) {
        usedFileNames.add(existingFileName.toLowerCase());
    }

    const namePreset = options.namePreset ?? 'source-time';

    return regions.map((region, sourceIndex) => {
        const normalized = normalizeAudioRegion(region, options.audioDuration);
        const baseName = createAudioRegionExportBaseName(sourcePath, normalized, region, namePreset);
        const preferredName = `${baseName}.wav`;
        const fileName = createUniqueAudioRegionFileName(preferredName, usedFileNames);

        return {
            collisionResolved: fileName !== preferredName,
            fileName,
            region: normalized,
            ...(region.name === undefined ? {} : { regionName: region.name }),
            sourceIndex,
        };
    });
}

export function createAudioRegionExportFileName(sourcePath: string, region: Pick<AudioRegion, 'end' | 'start'>): string {
    const normalized = normalizeAudioRegion(region);
    return `${createAudioRegionExportBaseName(sourcePath, normalized)}.wav`;
}

export function createAudioRegionFromSelection(
    anchorSeconds: number,
    pointerSeconds: number,
    audioDuration?: number,
): NormalizedAudioRegion {
    return normalizeAudioRegion({
        end: pointerSeconds,
        start: anchorSeconds,
    }, audioDuration);
}

export function encodeAudioBufferRegionsToWavFiles(
    audioBuffer: AudioBufferLike,
    sourcePath: string,
    regions: readonly AudioRegion[],
    options: AudioRegionBatchWavExportOptions = {},
): AudioRegionBatchWavExport[] {
    const plan = createAudioRegionBatchExportPlan(sourcePath, regions, {
        audioDuration: audioBuffer.duration,
        existingFileNames: options.existingFileNames,
        namePreset: options.namePreset,
    });

    return plan.map((entry) => ({
        ...entry,
        wavBytes: encodeAudioBufferRegionToWav(audioBuffer, entry.region, {
            bitDepth: options.bitDepth,
        }),
    }));
}

export function encodeAudioBufferRegionToWav(
    audioBuffer: AudioBufferLike,
    region: AudioRegion,
    options: AudioRegionExportOptions = {},
): Uint8Array {
    const bitDepth = options.bitDepth ?? 16;
    const normalized = normalizeAudioRegion(region, audioBuffer.duration);
    const channelCount = Math.max(1, audioBuffer.numberOfChannels);
    const startFrame = secondsToFrame(normalized.start, audioBuffer.sampleRate, audioBuffer.length);
    const endFrame = secondsToFrame(normalized.end, audioBuffer.sampleRate, audioBuffer.length);
    const frameCount = Math.max(0, endFrame - startFrame);
    const bytesPerSample = bitDepth / 8;
    const blockAlign = channelCount * bytesPerSample;
    const dataByteLength = frameCount * blockAlign;
    const output = new Uint8Array(44 + dataByteLength);
    const view = new DataView(output.buffer);

    writeAscii(output, 0, 'RIFF');
    view.setUint32(4, 36 + dataByteLength, true);
    writeAscii(output, 8, 'WAVE');
    writeAscii(output, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channelCount, true);
    view.setUint32(24, audioBuffer.sampleRate, true);
    view.setUint32(28, audioBuffer.sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeAscii(output, 36, 'data');
    view.setUint32(40, dataByteLength, true);

    const channelData = Array.from({ length: channelCount }, (_, channel) => audioBuffer.getChannelData(channel));
    let offset = 44;
    for (let frame = startFrame; frame < endFrame; frame += 1) {
        for (let channel = 0; channel < channelCount; channel += 1) {
            view.setInt16(offset, floatToPcm16(channelData[channel]?.[frame] ?? 0), true);
            offset += bytesPerSample;
        }
    }

    return output;
}

export function normalizeAudioRegion(
    region: Pick<AudioRegion, 'end' | 'start'>,
    audioDuration?: number,
): NormalizedAudioRegion {
    const maxTime = Number.isFinite(audioDuration) && audioDuration !== undefined
        ? Math.max(0, audioDuration)
        : Number.POSITIVE_INFINITY;
    const rawStart = Number.isFinite(region.start) ? region.start : 0;
    const rawEnd = Number.isFinite(region.end) ? region.end : rawStart + MIN_REGION_DURATION_SECONDS;
    const orderedStart = Math.min(rawStart, rawEnd);
    const orderedEnd = Math.max(rawStart, rawEnd);
    const start = clamp(orderedStart, 0, maxTime);
    const end = clamp(Math.max(orderedEnd, start + MIN_REGION_DURATION_SECONDS), start, maxTime);

    return {
        duration: Math.max(0, end - start),
        end,
        start,
    };
}

export function projectAudioRegionsToViewport(
    regions: readonly AudioRegion[],
    viewport: RegionViewport,
): ProjectedAudioRegion[] {
    if (viewport.duration <= 0) return [];

    const viewportStart = Math.max(0, viewport.start);
    const viewportEnd = viewportStart + viewport.duration;
    const projected: ProjectedAudioRegion[] = [];

    for (const region of regions) {
        const normalized = normalizeAudioRegion(region);
        if (normalized.end < viewportStart || normalized.start > viewportEnd) {
            continue;
        }

        projected.push({
            end: clamp(normalized.end - viewportStart, 0, viewport.duration),
            ...(region.name === undefined ? {} : { name: region.name }),
            sourceEnd: normalized.end,
            sourceStart: normalized.start,
            start: clamp(normalized.start - viewportStart, 0, viewport.duration),
        });
    }

    return projected;
}

function createAudioRegionExportBaseName(
    sourcePath: string,
    region: Pick<NormalizedAudioRegion, 'end' | 'start'>,
    sourceRegion?: Pick<AudioRegion, 'name'>,
    namePreset: AudioRegionBatchNamePreset = 'source-time',
): string {
    const sourceBaseName = getAudioSourceBaseName(sourcePath);
    const exportBaseName = namePreset === 'region-name-time'
        ? sanitizeAudioFileNamePart(sourceRegion?.name ?? '') || sourceBaseName
        : sourceBaseName;

    return `${exportBaseName}-${formatRegionTimestamp(region.start)}-${formatRegionTimestamp(region.end)}`;
}

function createUniqueAudioRegionFileName(name: string, usedFileNames: Set<string>): string {
    const lowerName = name.toLowerCase();
    if (!usedFileNames.has(lowerName)) {
        usedFileNames.add(lowerName);
        return name;
    }

    const { extension, root } = splitFileName(name);
    let index = 2;
    let candidate = `${root}_${index}${extension}`;

    while (usedFileNames.has(candidate.toLowerCase())) {
        index += 1;
        candidate = `${root}_${index}${extension}`;
    }

    usedFileNames.add(candidate.toLowerCase());
    return candidate;
}

function floatToPcm16(value: number): number {
    const clamped = clamp(value, -1, 1);
    return clamped < 0 ? Math.round(clamped * 0x80_00) : Math.round(clamped * 0x7F_FF);
}

function formatRegionTimestamp(seconds: number): string {
    const centiseconds = Math.max(0, Math.round(seconds * 100));
    const wholeSeconds = Math.floor(centiseconds / 100);
    const remainder = String(centiseconds % 100).padStart(2, '0');
    return `${wholeSeconds}p${remainder}s`;
}

function getAudioSourceBaseName(sourcePath: string): string {
    const sourceName = sourcePath.split(/[\\/]/u).findLast((segment) => segment.length > 0) ?? 'audio';
    const baseName = sourceName.replace(/\.[^.]+$/u, '') || 'audio';
    return sanitizeAudioFileNamePart(baseName) || 'audio';
}

function sanitizeAudioFileNamePart(value: string): string {
    return value.replaceAll(/[^a-z0-9._-]+/giu, '-').replaceAll(/^-|-$/gu, '');
}

function secondsToFrame(seconds: number, sampleRate: number, maxLength: number): number {
    return clamp(Math.round(seconds * sampleRate), 0, Math.max(0, maxLength));
}

function splitFileName(name: string): { extension: string; root: string } {
    const extensionIndex = name.lastIndexOf('.');
    if (extensionIndex <= 0) {
        return { extension: '', root: name || 'audio' };
    }

    return {
        extension: name.slice(extensionIndex),
        root: name.slice(0, extensionIndex) || 'audio',
    };
}

function writeAscii(output: Uint8Array, offset: number, value: string): void {
    for (let index = 0; index < value.length; index += 1) {
        output[offset + index] = value.codePointAt(index) ?? 0;
    }
}

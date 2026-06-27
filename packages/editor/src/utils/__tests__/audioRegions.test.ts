import { describe, expect, it } from 'vitest';

import {
    type AudioBufferLike,
    createAudioRegionBatchExportPlan,
    createAudioRegionExportFileName,
    createAudioRegionFromSelection,
    encodeAudioBufferRegionsToWavFiles,
    encodeAudioBufferRegionToWav,
    normalizeAudioRegion,
    projectAudioRegionsToViewport,
} from '../audioRegions';

describe('audioRegions', () => {
    it('normalizes selected regions with ordering and duration clamps', () => {
        expect(createAudioRegionFromSelection(2, 1, 5)).toEqual({
            duration: 1,
            end: 2,
            start: 1,
        });

        expect(normalizeAudioRegion({ end: 9, start: -1 }, 4)).toEqual({
            duration: 4,
            end: 4,
            start: 0,
        });
    });

    it('projects regions into a visible viewport', () => {
        expect(projectAudioRegionsToViewport([
            { end: 1, name: 'before', start: 0 },
            { end: 3, name: 'inside', start: 2 },
            { end: 6, name: 'overlap', start: 4 },
        ], { duration: 3, start: 2 })).toEqual([
            {
                end: 1,
                name: 'inside',
                sourceEnd: 3,
                sourceStart: 2,
                start: 0,
            },
            {
                end: 3,
                name: 'overlap',
                sourceEnd: 6,
                sourceStart: 4,
                start: 2,
            },
        ]);
    });

    it('creates deterministic WAV export names from source paths and regions', () => {
        expect(createAudioRegionExportFileName('/assets/voice/Line 01.ogg', { end: 2.5, start: 1.25 })).toBe('Line-01-1p25s-2p50s.wav');
        expect(createAudioRegionExportFileName('', { end: 0.01, start: 0 })).toBe('audio-0p00s-0p01s.wav');
    });

    it('plans batch WAV names with region-name presets and collision handling', () => {
        expect(createAudioRegionBatchExportPlan('/assets/voice/Line 01.ogg', [
            { end: 0.5, name: 'Hit', start: 0 },
            { end: 1.5, name: 'Hit', start: 1 },
            { end: 2.5, name: 'Bad / Cue', start: 2 },
            { end: 3.5, name: '', start: 3 },
        ], {
            existingFileNames: ['hit-0p00s-0p50s.wav'],
            namePreset: 'region-name-time',
        })).toEqual([
            {
                collisionResolved: true,
                fileName: 'Hit-0p00s-0p50s_2.wav',
                region: {
                    duration: 0.5,
                    end: 0.5,
                    start: 0,
                },
                regionName: 'Hit',
                sourceIndex: 0,
            },
            {
                collisionResolved: false,
                fileName: 'Hit-1p00s-1p50s.wav',
                region: {
                    duration: 0.5,
                    end: 1.5,
                    start: 1,
                },
                regionName: 'Hit',
                sourceIndex: 1,
            },
            {
                collisionResolved: false,
                fileName: 'Bad-Cue-2p00s-2p50s.wav',
                region: {
                    duration: 0.5,
                    end: 2.5,
                    start: 2,
                },
                regionName: 'Bad / Cue',
                sourceIndex: 2,
            },
            {
                collisionResolved: false,
                fileName: 'Line-01-3p00s-3p50s.wav',
                region: {
                    duration: 0.5,
                    end: 3.5,
                    start: 3,
                },
                regionName: '',
                sourceIndex: 3,
            },
        ]);
    });

    it('reserves batch export names within the same plan', () => {
        expect(createAudioRegionBatchExportPlan('/assets/voice/Line 01.ogg', [
            { end: 0.5, start: 0 },
            { end: 0.5, start: 0 },
        ], {
            existingFileNames: ['line-01-0p00s-0p50s.wav'],
        }).map((entry) => ({
            collisionResolved: entry.collisionResolved,
            fileName: entry.fileName,
        }))).toEqual([
            {
                collisionResolved: true,
                fileName: 'Line-01-0p00s-0p50s_2.wav',
            },
            {
                collisionResolved: true,
                fileName: 'Line-01-0p00s-0p50s_3.wav',
            },
        ]);
    });

    it('encodes selected audio buffer regions as 16-bit PCM WAV', () => {
        const buffer = createAudioBufferLike({
            channels: [
                new Float32Array([0, 0.5, 1, -1]),
                new Float32Array([0.25, -0.25, 0.75, -0.75]),
            ],
            sampleRate: 4,
        });

        const wav = encodeAudioBufferRegionToWav(buffer, { end: 0.75, start: 0.25 });
        const view = new DataView(wav.buffer);

        expect(readAscii(wav, 0, 4)).toBe('RIFF');
        expect(readAscii(wav, 8, 4)).toBe('WAVE');
        expect(readAscii(wav, 36, 4)).toBe('data');
        expect(view.getUint16(22, true)).toBe(2);
        expect(view.getUint32(24, true)).toBe(4);
        expect(view.getUint32(40, true)).toBe(8);
        expect(view.getInt16(44, true)).toBe(16_384);
        expect(view.getInt16(46, true)).toBe(-8192);
        expect(view.getInt16(48, true)).toBe(32_767);
        expect(view.getInt16(50, true)).toBe(24_575);
    });

    it('encodes batch audio regions with planned export names', () => {
        const buffer = createAudioBufferLike({
            channels: [
                new Float32Array([0, 0.5, 1, -1]),
            ],
            sampleRate: 4,
        });

        const [firstExport, secondExport] = encodeAudioBufferRegionsToWavFiles(buffer, '/assets/sfx/blip.wav', [
            { end: 0.5, name: 'Start', start: 0 },
            { end: 1, name: 'End', start: 0.5 },
        ], {
            namePreset: 'region-name-time',
        });

        expect(firstExport).toMatchObject({
            fileName: 'Start-0p00s-0p50s.wav',
            region: {
                duration: 0.5,
                end: 0.5,
                start: 0,
            },
            regionName: 'Start',
            sourceIndex: 0,
        });
        expect(secondExport).toMatchObject({
            fileName: 'End-0p50s-1p00s.wav',
            region: {
                duration: 0.5,
                end: 1,
                start: 0.5,
            },
            regionName: 'End',
            sourceIndex: 1,
        });
        expect(firstExport?.wavBytes.byteLength).toBe(48);
        expect(secondExport?.wavBytes.byteLength).toBe(48);
    });
});

function createAudioBufferLike(input: {
    channels: Float32Array[];
    sampleRate: number;
}): AudioBufferLike {
    const firstChannel = input.channels[0] ?? new Float32Array();

    return {
        duration: firstChannel.length / input.sampleRate,
        getChannelData: (channel) => input.channels[channel] ?? new Float32Array(firstChannel.length),
        length: firstChannel.length,
        numberOfChannels: input.channels.length,
        sampleRate: input.sampleRate,
    };
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
    return String.fromCodePoint(...bytes.slice(offset, offset + length));
}

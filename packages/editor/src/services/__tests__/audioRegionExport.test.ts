import { describe, expect, it, vi } from 'vitest';

import type { SaveAudioRegionDependencies } from '../audioRegionExport';

import { saveAudioRegionWavToProject } from '../audioRegionExport';

describe('audioRegionExport', () => {
    it('writes selected audio regions into the project asset tree', async () => {
        const dependencies = createDependencies({
            existingNames: [],
        });
        const bytes = new Uint8Array([1, 2, 3]);

        const result = await saveAudioRegionWavToProject('/project', {
            region: { end: 1.5, start: 0.25 },
            sourcePath: '/assets/voice/Line 01.ogg',
            wavBytes: bytes,
        }, dependencies);

        expect(result).toEqual({
            assetUrl: '/assets/audio-regions/Line-01-0p25s-1p50s.wav',
            collisionResolved: false,
            targetName: 'Line-01-0p25s-1p50s.wav',
            targetPath: '/project/assets/audio-regions/Line-01-0p25s-1p50s.wav',
        });
        expect(dependencies.mkdir).toHaveBeenCalledWith('/project/assets/audio-regions', true);
        expect(dependencies.writeBinaryFile).toHaveBeenCalledWith('/project/assets/audio-regions/Line-01-0p25s-1p50s.wav', bytes);
    });

    it('resolves save name collisions case-insensitively', async () => {
        const dependencies = createDependencies({
            existingNames: ['line-01-0p25s-1p50s.wav'],
        });

        await expect(saveAudioRegionWavToProject('/project', {
            region: { end: 1.5, start: 0.25 },
            sourcePath: '/assets/voice/Line 01.ogg',
            wavBytes: new Uint8Array([1]),
        }, dependencies)).resolves.toMatchObject({
            assetUrl: '/assets/audio-regions/Line-01-0p25s-1p50s_2.wav',
            collisionResolved: true,
            targetName: 'Line-01-0p25s-1p50s_2.wav',
        });
    });

    it('normalizes custom target folders', async () => {
        await expect(saveAudioRegionWavToProject('/project', {
            region: { end: 0.5, start: 0 },
            sourcePath: 'blip.wav',
            targetFolder: '/assets/sfx/clips/',
            wavBytes: new Uint8Array([1]),
        }, createDependencies())).resolves.toMatchObject({
            assetUrl: '/assets/sfx/clips/blip-0p00s-0p50s.wav',
            targetPath: '/project/assets/sfx/clips/blip-0p00s-0p50s.wav',
        });
    });

    it('rejects target folders outside project assets', async () => {
        await expect(saveAudioRegionWavToProject('/project', {
            region: { end: 0.5, start: 0 },
            sourcePath: 'blip.wav',
            targetFolder: '../outside',
            wavBytes: new Uint8Array([1]),
        }, createDependencies())).rejects.toThrow('Audio region target folder must be a project assets folder.');

        await expect(saveAudioRegionWavToProject('/project', {
            region: { end: 0.5, start: 0 },
            sourcePath: 'blip.wav',
            targetFolder: 'exports/audio',
            wavBytes: new Uint8Array([1]),
        }, createDependencies())).rejects.toThrow('Audio region target folder must be a project assets folder.');
    });

    it('uses region-name presets for named cue exports', async () => {
        await expect(saveAudioRegionWavToProject('/project', {
            namePreset: 'region-name-time',
            region: { end: 1.5, name: 'Voice / Line', start: 1 },
            sourcePath: '/assets/voice/Line 01.ogg',
            wavBytes: new Uint8Array([1]),
        }, createDependencies())).resolves.toMatchObject({
            assetUrl: '/assets/audio-regions/Voice-Line-1p00s-1p50s.wav',
            targetName: 'Voice-Line-1p00s-1p50s.wav',
        });
    });
});

function createDependencies(input: { existingNames?: string[] } = {}): SaveAudioRegionDependencies {
    return {
        join: vi.fn((...parts: string[]) => Promise.resolve(parts.join('/').replaceAll(/\/+/gu, '/'))),
        mkdir: vi.fn(() => Promise.resolve()),
        readDirectory: vi.fn(() => Promise.resolve((input.existingNames ?? []).map((name) => ({ name })))),
        writeBinaryFile: vi.fn(() => Promise.resolve()),
    };
}

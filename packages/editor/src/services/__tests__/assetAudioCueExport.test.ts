import { describe, expect, it } from 'vitest';

import type { AudioBufferLike } from '../../utils/audioRegions';

import {
    createAudiosheetCueExportRegions,
    exportAssetAudioCuesToProject,
    resolveAudiosheetAudioPath,
} from '../assetAudioCueExport';

function createAudioBuffer(duration = 1): AudioBufferLike {
    const sampleRate = 10;
    const length = Math.max(1, Math.round(duration * sampleRate));
    const data = new Float32Array(length);
    for (let index = 0; index < data.length; index += 1) data[index] = index / data.length;

    return {
        duration,
        getChannelData: () => data,
        length,
        numberOfChannels: 1,
        sampleRate,
    };
}

describe('assetAudioCueExport', () => {
    it('creates cue regions and extends open-ended cues to the source duration', () => {
        expect(createAudiosheetCueExportRegions({
            cues: {
                click: { duration: 0.2, start: 0.1 },
                tail: { start: 0.5 },
            },
            source: 'ui.wav',
        }, 1.5)).toEqual([
            { end: 0.30000000000000004, name: 'click', start: 0.1 },
            { end: 1.5, name: 'tail', start: 0.5 },
        ]);
    });

    it('resolves relative audiosheet source paths beside the descriptor', async () => {
        await expect(resolveAudiosheetAudioPath(
            'F:/project/assets/sfx/ui.sheet.json',
            '../audio/ui.wav',
            {
                dirname: async (path) => path.slice(0, path.lastIndexOf('/')),
                join: async (...parts) => parts.join('/'),
            },
        )).resolves.toBe('F:/project/assets/audio/ui.wav');
    });

    it('exports every cue from an audiosheet descriptor into project audio regions', async () => {
        const savedRegions: Array<{ name?: string; start: number; end: number; }> = [];

        const result = await exportAssetAudioCuesToProject('F:/project', {
            descriptorAssetUrl: '/assets/sfx/ui.sheet.json',
            targetFolder: 'assets/exported-cues',
        }, {
            decodeAudioSource: async (path) => {
                expect(path).toBe('F:/project/assets/sfx/ui.wav');
                return createAudioBuffer(1.25);
            },
            dirname: async (path) => path.slice(0, path.lastIndexOf('/')),
            join: async (...parts) => parts.join('/'),
            readTextFile: async (path) => {
                expect(path).toBe('F:/project/assets/sfx/ui.sheet.json');
                return JSON.stringify({
                    cues: {
                        click: { duration: 0.2, start: 0 },
                        tail: { start: 0.75 },
                    },
                    source: 'ui.wav',
                });
            },
            saveRegion: async (_projectPath, input) => {
                savedRegions.push(input.region);
                return {
                    assetUrl: `/assets/exported-cues/${input.region.name}.wav`,
                    collisionResolved: false,
                    targetName: `${input.region.name}.wav`,
                    targetPath: `F:/project/assets/exported-cues/${input.region.name}.wav`,
                };
            },
        });

        expect(result).toMatchObject({
            assetUrls: ['/assets/exported-cues/click.wav', '/assets/exported-cues/tail.wav'],
            descriptorAssetUrl: '/assets/sfx/ui.sheet.json',
            exportedCount: 2,
            sourcePath: 'F:/project/assets/sfx/ui.wav',
            targetFolder: 'assets/exported-cues',
        });
        expect(savedRegions).toEqual([
            { end: 0.2, name: 'click', start: 0 },
            { end: 1.25, name: 'tail', start: 0.75 },
        ]);
    });

    it('rejects non-audiosheet descriptors', async () => {
        await expect(exportAssetAudioCuesToProject('F:/project', {
            descriptorAssetUrl: '/assets/sprites/hero.sheet.json',
        }, {
            decodeAudioSource: async () => createAudioBuffer(),
            dirname: async (path) => path,
            join: async (...parts) => parts.join('/'),
            readTextFile: async () => JSON.stringify({
                format: 'atlas',
                frames: {},
                source: 'hero.png',
            }),
            saveRegion: async () => {
                throw new Error('should not save');
            },
        })).rejects.toThrow('not an audiosheet');
    });
});

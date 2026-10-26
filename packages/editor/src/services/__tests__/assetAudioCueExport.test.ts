import { describe, expect, it, vi } from 'vitest';

import type { AudioBufferLike } from '../../utils/audioRegions';

import { encodeAudioBufferRegionToWav } from '../../utils/audioRegions';
import {
    createAudiosheetCueExportRegions,
    exportAssetAudioCuesToProject,
    resolveAudiosheetAudioPath,
} from '../assetAudioCueExport';
import { saveAudioRegionWavToProject } from '../audioRegionExport';
import { createBrowserFsAdapter } from '../fs/browserFsAdapter';
import { createPickerGlobal, MemoryDirectoryHandle } from './browserFsAdapter.test-utilities';

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
                dirname: (path) => Promise.resolve(path.slice(0, path.lastIndexOf('/'))),
                join: (...parts) => Promise.resolve(parts.join('/')),
            },
        )).resolves.toBe('F:/project/assets/audio/ui.wav');
    });

    it('exports every cue from an audiosheet descriptor into project audio regions', async () => {
        const savedRegions: Array<{ end: number; name?: string; start: number; }> = [];

        const result = await exportAssetAudioCuesToProject('F:/project', {
            descriptorAssetUrl: '/assets/sfx/ui.sheet.json',
            targetFolder: 'assets/exported-cues',
        }, {
            decodeAudioSource: (path) => {
                expect(path).toBe('F:/project/assets/sfx/ui.wav');
                return Promise.resolve(createAudioBuffer(1.25));
            },
            dirname: (path) => Promise.resolve(path.slice(0, path.lastIndexOf('/'))),
            join: (...parts) => Promise.resolve(parts.join('/')),
            readTextFile: (path) => {
                expect(path).toBe('F:/project/assets/sfx/ui.sheet.json');
                return Promise.resolve(JSON.stringify({
                    cues: {
                        click: { duration: 0.2, start: 0 },
                        tail: { start: 0.75 },
                    },
                    source: 'ui.wav',
                }));
            },
            saveRegion: (_projectPath, input) => {
                savedRegions.push(input.region);
                return Promise.resolve({
                    assetUrl: `/assets/exported-cues/${input.region.name}.wav`,
                    collisionResolved: false,
                    targetName: `${input.region.name}.wav`,
                    targetPath: `F:/project/assets/exported-cues/${input.region.name}.wav`,
                });
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
            decodeAudioSource: () => Promise.resolve(createAudioBuffer()),
            dirname: (path) => Promise.resolve(path),
            join: (...parts) => Promise.resolve(parts.join('/')),
            readTextFile: () => Promise.resolve(JSON.stringify({
                format: 'atlas',
                frames: {},
                source: 'hero.png',
            })),
            saveRegion: () => Promise.reject(new Error('should not save')),
        })).rejects.toThrow('not an audiosheet');
    });

    it('retains completed WAV bytes and stops following cues after a later write failure', async () => {
        const root = new MemoryDirectoryHandle('Audio');
        const adapter = createBrowserFsAdapter(createPickerGlobal(root));
        const projectPath = adapter.mountDirectory(root);
        const audio = createAudioBuffer();
        const error = { code: 'io', message: 'permission denied' };
        const write = vi.fn().mockImplementationOnce(adapter.writeBinaryFileExclusive!).mockRejectedValue(error);
        await expect(exportAssetAudioCuesToProject(projectPath, {
            descriptorAssetUrl: '/assets/cues.json',
        }, {
            decodeAudioSource: () => Promise.resolve(audio),
            dirname: adapter.dirname,
            join: adapter.join,
            readTextFile: () => Promise.resolve(JSON.stringify({
                cues: { a: { duration: 0.2, start: 0 }, b: { duration: 0.2, start: 0.2 }, c: { duration: 0.2, start: 0.4 } },
                source: 'audio.wav',
            })),
            saveRegion: (path, input) => saveAudioRegionWavToProject(path, input, {
                join: adapter.join, mkdir: adapter.mkdir, readDirectory: adapter.readDirectory,
                writeBinaryFileExclusive: write,
            }),
        })).rejects.toBe(error);
        expect(write).toHaveBeenCalledTimes(2);
        const directory = `${projectPath}/assets/audio-regions`;
        await expect(adapter.readDirectory(directory)).resolves.toMatchObject([{ name: 'a-0p00s-0p20s.wav' }]);
        await expect(adapter.readBinaryFile(`${directory}/a-0p00s-0p20s.wav`)).resolves.toEqual(
            encodeAudioBufferRegionToWav(audio, { end: 0.2, start: 0 }),
        );
    });
});

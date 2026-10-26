import { describe, expect, it, vi } from 'vitest';

import type { SaveAudioRegionDependencies } from '../audioRegionExport';

import { saveAudioRegionWavToProject } from '../audioRegionExport';
import { createBrowserFsAdapter } from '../fs/browserFsAdapter';
import { createPickerGlobal, MemoryDirectoryHandle } from './browserFsAdapter.test-utilities';

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
        expect(dependencies.mkdir).toHaveBeenCalledWith('/project/assets/audio-regions', true, expect.any(Function));
        expect(dependencies.writeBinaryFileExclusive).toHaveBeenCalledWith('/project/assets/audio-regions/Line-01-0p25s-1p50s.wav', bytes, expect.any(Function));
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

    it('preserves a WAV created after listing and reports the suffixed destination', async () => {
        const { adapter, dependencies, path } = browserFixture();
        const read = dependencies.readDirectory;
        dependencies.readDirectory = async directory => {
            const entries = await read(directory);
            await adapter.writeBinaryFile(`${directory}/BLIP-0P00S-0P50S.WAV`, new Uint8Array([9, 8, 7]));
            return entries;
        };
        const bytes = new Uint8Array([1, 2, 3]);
        const result = await saveAudioRegionWavToProject(path, blip(bytes), dependencies);
        expect(result).toMatchObject({ collisionResolved: true, targetName: 'blip-0p00s-0p50s_2.wav' });
        expect(result.assetUrl).toBe('/assets/audio-regions/blip-0p00s-0p50s_2.wav');
        await expect(adapter.readBinaryFile(`${path}/assets/audio-regions/BLIP-0P00S-0P50S.WAV`)).resolves.toEqual(new Uint8Array([9, 8, 7]));
        await expect(adapter.readBinaryFile(result.targetPath)).resolves.toEqual(bytes);
    });

    it('preserves both concurrent exports using the real browser adapter with the same listing', async () => {
        const { adapter, dependencies, path } = browserFixture();
        let listed = 0;
        let release!: () => void;
        const barrier = new Promise<void>(resolve => { release = resolve; });
        const read = dependencies.readDirectory;
        dependencies.readDirectory = async directory => {
            const entries = await read(directory);
            if (++listed === 2) release();
            await barrier;
            return entries;
        };
        const bytes = [new Uint8Array([5, 6]), new Uint8Array([7, 8])];
        const results = await Promise.all(bytes.map(content => saveAudioRegionWavToProject(path, blip(content), dependencies)));
        expect(new Set(results.map(result => result.targetPath)).size).toBe(2);
        expect(results.map(result => result.collisionResolved).toSorted()).toEqual([false, true]);
        for (const [index, result] of results.entries()) {
            await expect(adapter.readBinaryFile(result.targetPath)).resolves.toEqual(bytes[index]);
        }
        await expect(adapter.readDirectory(`${path}/assets/audio-regions`)).resolves.toHaveLength(2);
    });

    it('skips a directory created at the planned filename without modifying it', async () => {
        const { adapter, dependencies, path } = browserFixture();
        const read = dependencies.readDirectory;
        dependencies.readDirectory = async directory => {
            const entries = await read(directory);
            await adapter.mkdir(`${directory}/blip-0p00s-0p50s.wav`);
            await adapter.writeTextFile(`${directory}/blip-0p00s-0p50s.wav/keep`, 'original');
            return entries;
        };
        const result = await saveAudioRegionWavToProject(path, blip(), dependencies);
        expect(result.targetName).toBe('blip-0p00s-0p50s_2.wav');
        await expect(adapter.readTextFile(`${path}/assets/audio-regions/blip-0p00s-0p50s.wav/keep`)).resolves.toBe('original');
    });

    it('retries native structured collision errors without relying on their message', async () => {
        const dependencies = createDependencies();
        const write = vi.fn<SaveAudioRegionDependencies['writeBinaryFileExclusive']>(() => Promise.resolve()).mockRejectedValueOnce({ code: 'alreadyExists', message: 'occupied' });
        dependencies.writeBinaryFileExclusive = write;
        const result = await saveAudioRegionWavToProject('/project', blip(), dependencies);
        expect(result.targetName).toBe('blip-0p00s-0p50s_2.wav');
        expect(result.collisionResolved).toBe(true);
        expect(write).toHaveBeenCalledTimes(2);
    });

    it.each([
        { code: 'io', message: 'permission denied' },
        { code: 'invalidTarget', message: 'invalid target' },
        { code: 'readOnly', message: 'read only' },
        new Error('Destination already exists.'),
        'alreadyExists',
        undefined,
    ])('propagates unrelated failures without retrying: %j', async error => {
        const dependencies = createDependencies();
        const write = vi.fn<SaveAudioRegionDependencies['writeBinaryFileExclusive']>().mockRejectedValue(error);
        dependencies.writeBinaryFileExclusive = write;
        await expect(saveAudioRegionWavToProject('/project', blip(), dependencies)).rejects.toBe(error);
        expect(write).toHaveBeenCalledTimes(1);
    });

    it('bounds repeated contention and retains the final collision as the cause', async () => {
        const dependencies = createDependencies();
        const error = { code: 'alreadyExists', message: 'occupied' };
        const write = vi.fn<SaveAudioRegionDependencies['writeBinaryFileExclusive']>().mockRejectedValue(error);
        dependencies.writeBinaryFileExclusive = write;
        await expect(saveAudioRegionWavToProject('/project', blip(), dependencies)).rejects.toMatchObject({
            cause: error,
            message: 'Could not create a WAV after 32 filename collisions in /project/assets/audio-regions. Try exporting again.',
        });
        expect(write).toHaveBeenCalledTimes(32);
        expect(new Set(write.mock.calls.map(([target]) => target)).size).toBe(32);
    });

    it('allows a later save after a failed exclusive write', async () => {
        const { adapter, dependencies, path } = browserFixture();
        const original = dependencies.writeBinaryFileExclusive;
        dependencies.writeBinaryFileExclusive = vi.fn().mockRejectedValueOnce(new Error('denied')).mockImplementation(original);
        await expect(saveAudioRegionWavToProject(path, blip(), dependencies)).rejects.toThrow('denied');
        await expect(adapter.readDirectory(`${path}/assets/audio-regions`)).resolves.toHaveLength(0);
        const result = await saveAudioRegionWavToProject(path, blip(), dependencies);
        expect(result.collisionResolved).toBe(false);
        await expect(adapter.readBinaryFile(result.targetPath)).resolves.toEqual(new Uint8Array([1]));
    });
});

function blip(wavBytes = new Uint8Array([1])) {
    return { region: { end: 0.5, start: 0 }, sourcePath: 'blip.wav', wavBytes };
}

function browserFixture() {
    const root = new MemoryDirectoryHandle('Audio');
    const adapter = createBrowserFsAdapter(createPickerGlobal(root));
    const dependencies: SaveAudioRegionDependencies = {
        join: adapter.join, mkdir: adapter.mkdir, readDirectory: adapter.readDirectory,
        writeBinaryFileExclusive: adapter.writeBinaryFileExclusive!,
    };
    return { adapter, dependencies, path: adapter.mountDirectory(root) };
}

function createDependencies(input: { existingNames?: string[] } = {}): SaveAudioRegionDependencies {
    return {
        join: vi.fn((...parts: string[]) => Promise.resolve(parts.join('/').replaceAll(/\/+/gu, '/'))),
        mkdir: vi.fn(() => Promise.resolve()),
        readDirectory: vi.fn(() => Promise.resolve((input.existingNames ?? []).map((name) => ({ name })))),
        writeBinaryFileExclusive: vi.fn(() => Promise.resolve()),
    };
}

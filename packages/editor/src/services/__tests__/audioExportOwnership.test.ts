import { describe, expect, it, vi } from 'vitest';

import type { AssetAudioCueExportDependencies } from '../assetAudioCueExport';
import type { SaveAudioRegionDependencies } from '../audioRegionExport';

import { encodeAudioBufferRegionToWav } from '../../utils/audioRegions';
import { exportAssetAudioCuesToProject } from '../assetAudioCueExport';
import { AudioExportRetiredError } from '../audioExportOwnership';
import { saveAudioRegionWavToProject } from '../audioRegionExport';
import { browserFsAdapter, createBrowserFsAdapter } from '../fs/browserFsAdapter';
import { createPickerGlobal, MemoryDirectoryHandle, MemoryFileHandle } from './browserFsAdapter.test-utilities';

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, reject, resolve };
}

const input = { region: { end: 0.2, start: 0 }, sourcePath: 'a.wav', wavBytes: new Uint8Array([1, 2]) };

function regionDependencies(): SaveAudioRegionDependencies {
    return {
        join: vi.fn((...parts) => Promise.resolve(parts.join('/'))),
        mkdir: vi.fn(() => Promise.resolve()),
        readDirectory: vi.fn(() => Promise.resolve([])),
        writeBinaryFileExclusive: vi.fn(() => Promise.resolve()),
    };
}

const audio = {
    duration: 1, getChannelData: () => new Float32Array([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]),
    length: 10, numberOfChannels: 1, sampleRate: 10,
};

function cueDependencies(): AssetAudioCueExportDependencies {
    return {
        decodeAudioSource: vi.fn(() => Promise.resolve(audio)),
        dirname: vi.fn<AssetAudioCueExportDependencies['dirname']>(path => Promise.resolve(path.slice(0, path.lastIndexOf('/')))),
        join: vi.fn((...parts) => Promise.resolve(parts.join('/'))),
        readTextFile: vi.fn(() => Promise.resolve(JSON.stringify({
            cues: { a: { duration: 0.2, start: 0 }, b: { duration: 0.2, start: 0.2 } }, source: 'audio.wav',
        }))),
        saveRegion: vi.fn(() => Promise.resolve({ assetUrl: '/a.wav', collisionResolved: false, targetName: 'a.wav', targetPath: '/a.wav' })),
    };
}

describe('audio export service ownership', () => {
    it('prevents all preparation when both service requests are already retired', async () => {
        const region = regionDependencies();
        await expect(saveAudioRegionWavToProject('/project', input, region, () => false)).rejects.toBeInstanceOf(AudioExportRetiredError);
        expect(region.join).not.toHaveBeenCalled();
        const cues = cueDependencies();
        await expect(exportAssetAudioCuesToProject('/project', { descriptorAssetUrl: '/assets/cues.json' }, cues, () => false)).rejects.toBeInstanceOf(AudioExportRetiredError);
        expect(cues.join).not.toHaveBeenCalled();
    });

    it.each(['join', 'targetJoin', 'mkdir', 'readDirectory'] as const)('stops after retired region %s success or failure', async phase => {
        for (const fail of [false, true]) {
            const deps = regionDependencies();
            const gate = deferred<never>();
            const entered = deferred<void>();
            if (phase === 'targetJoin') {
                deps.join = vi.fn<SaveAudioRegionDependencies['join']>().mockResolvedValueOnce('/project/assets/audio-regions').mockImplementation(() => { entered.resolve(); return gate.promise; });
            } else deps[phase] = vi.fn(() => { entered.resolve(); return gate.promise; });
            let current = true;
            const stale = saveAudioRegionWavToProject('/project', input, deps, () => current);
            const rejection = expect(stale).rejects.toBeInstanceOf(AudioExportRetiredError);
            await entered.promise;
            current = false;
            if (fail) gate.reject(new Error('obsolete failure'));
            else gate.resolve((phase === 'join' ? '/project/assets/audio-regions' : (phase === 'readDirectory' ? [] : undefined)) as never);
            await rejection;
            expect(deps.writeBinaryFileExclusive).not.toHaveBeenCalled();
        }
    });

    it('allows the successor to create exact bytes while the retired listing is held', async () => {
        const root = new MemoryDirectoryHandle('Audio');
        const adapter = createBrowserFsAdapter(createPickerGlobal(root));
        const path = adapter.mountDirectory(root);
        const gate = deferred<[]>();
        const entered = deferred<void>();
        const deps = {
            ...adapter,
            readDirectory: vi.fn<SaveAudioRegionDependencies['readDirectory']>().mockImplementationOnce(() => { entered.resolve(); return gate.promise; }).mockImplementation(adapter.readDirectory),
            writeBinaryFileExclusive: adapter.writeBinaryFileExclusive!,
        };
        let current = true;
        const stale = saveAudioRegionWavToProject(path, input, deps, () => current);
        const rejection = expect(stale).rejects.toBeInstanceOf(AudioExportRetiredError);
        await entered.promise;
        current = false;
        const successor = await saveAudioRegionWavToProject(path, input, deps);
        gate.resolve([]);
        await rejection;
        await expect(adapter.readBinaryFile(successor.targetPath)).resolves.toEqual(input.wavBytes);
        await expect(adapter.readDirectory(`${path}/assets/audio-regions`)).resolves.toHaveLength(1);
    });

    it.each([Object.assign(new Error('collision'), { code: 'alreadyExists' }), Object.assign(new Error('denied'), { code: 'io' }), undefined])('retirement during write forbids retry and overrides failure %j', async error => {
        const deps = regionDependencies();
        let current = true;
        deps.writeBinaryFileExclusive = vi.fn(() => {
            current = false;
            return error === undefined ? Promise.resolve() : Promise.reject(error);
        });
        await expect(saveAudioRegionWavToProject('/project', input, deps, () => current)).rejects.toBeInstanceOf(AudioExportRetiredError);
        expect(deps.writeBinaryFileExclusive).toHaveBeenCalledTimes(1);
        expect(deps.join).toHaveBeenCalledTimes(2);
    });

    it.each(['join', 'sourceJoin', 'readTextFile', 'dirname', 'decodeAudioSource', 'saveRegion'] as const)('retires cue preparation at %s for success and failure', async phase => {
        for (const fail of [false, true]) {
            const deps = cueDependencies();
            const gate = deferred<never>();
            const entered = deferred<void>();
            if (phase === 'sourceJoin') {
                deps.join = vi.fn<AssetAudioCueExportDependencies['join']>().mockResolvedValueOnce('/project/assets/cues.json').mockImplementation(() => { entered.resolve(); return gate.promise; });
            } else deps[phase] = vi.fn(() => { entered.resolve(); return gate.promise; });
            let current = true;
            const stale = exportAssetAudioCuesToProject('/project', { descriptorAssetUrl: '/assets/cues.json' }, deps, () => current);
            const rejection = expect(stale).rejects.toBeInstanceOf(AudioExportRetiredError);
            await entered.promise;
            current = false;
            if (fail) gate.reject(new Error('obsolete failure'));
            else gate.resolve(undefined as never);
            await rejection;
            expect(deps.saveRegion).toHaveBeenCalledTimes(phase === 'saveRegion' ? 1 : 0);
        }
    });

    it('retains exact completed first cue bytes without scheduling the next cue', async () => {
        const root = new MemoryDirectoryHandle('Audio');
        const adapter = createBrowserFsAdapter(createPickerGlobal(root));
        const path = adapter.mountDirectory(root);
        const deps = cueDependencies();
        let current = true;
        const isCurrent = () => current;
        deps.saveRegion = vi.fn<AssetAudioCueExportDependencies['saveRegion']>(async (project, region, ownership) => {
            expect(ownership).toBe(isCurrent);
            const result = await saveAudioRegionWavToProject(project, region, {
                ...adapter, writeBinaryFileExclusive: adapter.writeBinaryFileExclusive!,
            }, ownership);
            current = false;
            return result;
        });
        await expect(exportAssetAudioCuesToProject(path, { descriptorAssetUrl: '/assets/cues.json' }, deps, isCurrent)).rejects.toBeInstanceOf(AudioExportRetiredError);
        expect(deps.saveRegion).toHaveBeenCalledTimes(1);
        const directory = `${path}/assets/audio-regions`;
        await expect(adapter.readDirectory(directory)).resolves.toMatchObject([{ name: 'a-0p00s-0p20s.wav' }]);
        await expect(adapter.readBinaryFile(`${directory}/a-0p00s-0p20s.wav`)).resolves.toEqual(encodeAudioBufferRegionToWav(audio, input.region));
    });

    it('passes default cue ownership through the filesystem facade into browser stream checks', async () => {
        const root = new MemoryDirectoryHandle('DefaultAudio');
        const path = browserFsAdapter.mountDirectory(root);
        await browserFsAdapter.mkdir(`${path}/assets/audio-regions`);
        const directory = root.directories.get('assets')!.directories.get('audio-regions')!;
        const file = new MemoryFileHandle('a-0p00s-0p20s.wav', '');
        const writable = await file.createWritable();
        let current = true;
        vi.spyOn(directory, 'getFileHandle').mockImplementation(name => {
            directory.files.set(name, file);
            return Promise.resolve(file);
        });
        vi.spyOn(file, 'createWritable').mockImplementation(() => {
            current = false;
            return Promise.resolve(writable);
        });
        try {
            await expect(exportAssetAudioCuesToProject(path, { descriptorAssetUrl: '/assets/cues.json' }, {
                decodeAudioSource: () => Promise.resolve(audio),
                readTextFile: cueDependencies().readTextFile,
            }, () => current)).rejects.toBeInstanceOf(AudioExportRetiredError);
            expect(file.abortCount).toBe(1);
            expect([...directory.files.keys()]).toEqual(['a-0p00s-0p20s.wav']);
            await expect(browserFsAdapter.readBinaryFile(`${path}/assets/audio-regions/${file.name}`)).resolves.toEqual(new Uint8Array());
        } finally {
            browserFsAdapter.clearMountedDirectories();
        }
    });
});

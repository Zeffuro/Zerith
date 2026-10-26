import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@pixi/sound', async () => {
    const { createPixiSoundMock } = await import('../../test-utils/pixiSoundMock');
    return { sound: createPixiSoundMock() };
});

import { sound } from '@pixi/sound';
import { DOMAdapter } from 'pixi.js';

import { createMockSound, createPixiSoundMock } from '../../test-utils/pixiSoundMock';
import { AudioManager } from '../AudioManager';

type Load = { alias: string; finish: (error?: Error) => void; resource: Resource; url: string };
type Resource = ReturnType<typeof createMockSound>;
const library = sound as unknown as ReturnType<typeof createPixiSoundMock>;
let aliases: Map<string, Resource>;
let loads: Load[];
let delayed: boolean;

function latestLoad(url: string): Load {
    return loads.findLast(load => load.url === url)!;
}

function play(manager: AudioManager, kind: 'bgm' | 'cue' | 'sfx' | 'voice') {
    switch (kind) {
        case 'bgm': { return manager.playBgm('shared.wav', true);
        }
        case 'cue': { return manager.playCue('sheet', 'hit');
        }
        case 'sfx': { return manager.playSfx('shared.wav');
        }
        case 'voice': { return manager.playVoice('shared.wav');
        }
    }
}

describe('AudioManager resource ownership', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
        aliases = new Map();
        loads = [];
        delayed = false;
        library.useLegacy = true;
        library.volumeAll = 0.9;
        library.exists.mockImplementation(alias => aliases.has(alias));
        library.find.mockImplementation(alias => aliases.get(alias));
        library.add.mockImplementation((alias, options) => {
            const resource = createMockSound(!delayed);
            const finish = (error?: Error) => { resource.isLoaded = !error; options.loaded?.(error); };
            aliases.set(alias, resource);
            loads.push({ alias, finish, resource, url: options.url });
            if (!delayed) finish();
            return resource;
        });
        library.remove.mockImplementation(alias => { aliases.get(alias)?.destroy(); aliases.delete(alias); });
        library.play.mockImplementation((...playArguments: unknown[]) => {
            const [alias, options] = playArguments as [string, { singleInstance?: boolean; volume: number }];
            const resource = aliases.get(alias)!;
            if (options.singleInstance) resource.instances.length = 0;
            resource.instances.push({ volume: options.volume });
            return Promise.resolve();
        });
        library.stop.mockImplementation((...stopArguments: unknown[]) => { aliases.get(stopArguments[0] as string)!.instances.length = 0; });
    });

    it.each(['shared.wav', 'different.wav'])('isolates same and distinct URLs across managers (%s)', async secondUrl => {
        const external = createMockSound();
        aliases.set('shared.wav', external);
        const first = new AudioManager({ masterVolume: 0.5 });
        const second = new AudioManager({ masterVolume: 0.8 });
        first.init();
        await first.playBgm('shared.wav', true, 0.6);
        const firstLoad = latestLoad('shared.wav');
        second.init();
        await second.playBgm(secondUrl, true, 0.7);
        const secondLoad = latestLoad(secondUrl);

        expect(firstLoad.alias).not.toBe(secondLoad.alias);
        expect(first.currentBgmUrl).toBe('shared.wav');
        expect(second.currentBgmUrl).toBe(secondUrl);
        first.setMasterVolume(0.2);
        first.muted = true;
        first.setVolume('bgm', 0.3);
        expect(firstLoad.resource.volume).toBe(0);
        expect(firstLoad.resource.instances[0].volume).toBe(0.18);
        expect(secondLoad.resource.volume).toBe(0.8);
        expect(secondLoad.resource.instances[0].volume).toBe(0.7);
        first.stopAll();
        expect(firstLoad.resource.instances).toHaveLength(0);
        expect(secondLoad.resource.instances).toHaveLength(1);
        first.destroy();
        first.destroy();
        first.setMasterVolume(0);
        first.muted = false;
        first.stopAll();
        expect(firstLoad.resource.destroy).toHaveBeenCalledTimes(1);
        expect(secondLoad.resource.destroy).not.toHaveBeenCalled();
        expect(second.audioExists(secondUrl)).toBe(true);
        expect(secondLoad.resource.instances).toHaveLength(1);
        expect(external.destroy).not.toHaveBeenCalled();
        expect(external.volume).toBe(1);
        expect(aliases.get('shared.wav')).toBe(external);
        expect(library.init).not.toHaveBeenCalled();
        expect(library.stopAll).not.toHaveBeenCalled();
        expect(library.removeAll).not.toHaveBeenCalled();
        expect(library.volumeAll).toBe(0.9);
    });

    it.each(['success', 'failure'])('ignores late pending %s after destroy without touching a successor', async outcome => {
        delayed = true;
        const first = new AudioManager();
        const pending = first.playBgm('shared.wav', true);
        const firstLoad = latestLoad('shared.wav');
        const rejected = expect(pending).rejects.toThrow('destroyed');
        first.destroy();
        first.destroy();
        await rejected;
        delayed = false;
        const second = new AudioManager();
        await second.playBgm('shared.wav', true);
        const secondLoad = latestLoad('shared.wav');
        firstLoad.finish(outcome === 'failure' ? new Error('Late failure') : undefined);
        await Promise.resolve();
        expect(firstLoad.resource.destroy).toHaveBeenCalledTimes(1);
        expect(secondLoad.resource.destroy).not.toHaveBeenCalled();
        expect(secondLoad.resource.instances).toHaveLength(1);
        expect(second.audioExists('shared.wav')).toBe(true);
        expect(library.play).toHaveBeenCalledTimes(1);
        expect(first.currentBgmUrl).toBeUndefined();
    });

    it.each(['bgm', 'sfx', 'voice', 'cue'] as const)('stopAll prevents deferred %s playback while retaining the owned preload', async kind => {
        const manager = new AudioManager();
        if (kind === 'cue') await manager.loadAudiosheet('sheet', { cues: { hit: { start: 0 } }, source: 'shared.wav' });
        delayed = true;
        const pending = play(manager, kind);
        manager.stopAll();
        latestLoad('shared.wav').finish();
        await pending;
        expect(library.play).not.toHaveBeenCalled();
        expect(manager.currentBgmUrl).toBeUndefined();
        expect(manager.audioExists('shared.wav')).toBe(true);
    });

    it('stopBgm cancels pending BGM without cancelling a pending sound effect', async () => {
        delayed = true;
        const manager = new AudioManager();
        const bgm = manager.playBgm('bgm.wav', true);
        const sfx = manager.playSfx('sfx.wav');
        manager.stopBgm();
        latestLoad('bgm.wav').finish();
        latestLoad('sfx.wav').finish();
        await Promise.all([bgm, sfx]);
        expect(library.play).toHaveBeenCalledExactlyOnceWith(latestLoad('sfx.wav').alias, expect.anything());
        expect(manager.currentBgmUrl).toBeUndefined();
    });

    it.each(['success', 'failure'])('disposes its replaced pending handle on %s and retries without adopting external audio', async outcome => {
        delayed = true;
        const manager = new AudioManager();
        const pending = manager.preloadAudio('shared.wav');
        const oldLoad = latestLoad('shared.wav');
        const external = createMockSound();
        aliases.set(oldLoad.alias, external);
        const rejected = expect(pending).rejects.toThrow(outcome === 'failure' ? 'Load failure' : 'replaced');
        oldLoad.finish(outcome === 'failure' ? new Error('Load failure') : undefined);
        await rejected;
        expect(oldLoad.resource.destroy).toHaveBeenCalledTimes(1);
        expect(external.destroy).not.toHaveBeenCalled();
        expect(aliases.get(oldLoad.alias)).toBe(external);
        expect(manager.audioExists('shared.wav')).toBe(false);
        const retry = manager.preloadAudio('shared.wav');
        const newLoad = latestLoad('shared.wav');
        expect(newLoad.alias).not.toBe(oldLoad.alias);
        oldLoad.finish(new Error('Old repeated failure'));
        newLoad.finish();
        await retry;
        manager.destroy();
        expect(newLoad.resource.destroy).toHaveBeenCalledTimes(1);
        expect(oldLoad.resource.destroy).toHaveBeenCalledTimes(1);
        expect(external.destroy).not.toHaveBeenCalled();
    });

    it('never pauses, stops or changes an external replacement of a loaded alias', async () => {
        const manager = new AudioManager();
        await manager.playBgm('shared.wav', true);
        const owned = latestLoad('shared.wav');
        const external = createMockSound();
        external.instances.push({ volume: 0.9 });
        aliases.set(owned.alias, external);
        manager.pauseBgm();
        manager.resumeBgm();
        manager.setMasterVolume(0.1);
        manager.setVolume('bgm', 0.1);
        manager.muted = true;
        manager.stopBgm();
        manager.stopAll();
        manager.destroy();
        expect(library.pause).not.toHaveBeenCalled();
        expect(library.resume).not.toHaveBeenCalled();
        expect(library.stop).not.toHaveBeenCalled();
        expect(external.instances).toEqual([{ volume: 0.9 }]);
        expect(external.volume).toBe(1);
        expect(external.destroy).not.toHaveBeenCalled();
        expect(owned.resource.destroy).toHaveBeenCalledTimes(1);
    });

    it.each(['bgm', 'sfx', 'voice', 'cue'] as const)('rejects %s when destroy occurs after preload completion and before playback', async kind => {
        const manager = new AudioManager();
        if (kind === 'cue') await manager.loadAudiosheet('sheet', { cues: { hit: { start: 0 } }, source: 'shared.wav' });
        await manager.preloadAudio('shared.wav');
        const pending = play(manager, kind);
        manager.destroy();
        await expect(pending).rejects.toThrow('destroyed');
        expect(library.play).not.toHaveBeenCalled();
        expect(manager.currentBgmUrl).toBeUndefined();
        expect(latestLoad('shared.wav').resource.destroy).toHaveBeenCalledTimes(1);
    });

    it.each(['network', 'http'])('rejects WebAudio %s failures and retries current bytes without cached alias adoption', async failure => {
        library.useLegacy = false;
        const fetch = vi.spyOn(DOMAdapter.get(), 'fetch');
        if (failure === 'network') fetch.mockRejectedValueOnce(new Error('Network failure'));
        else fetch.mockResolvedValueOnce(new Response('missing', { status: 404 }));
        const external = createMockSound();
        aliases.set('shared.wav', external);
        const manager = new AudioManager();
        await expect(manager.preloadAudio('shared.wav')).rejects.toThrow(failure === 'network' ? 'Network failure' : '404');
        expect(manager.audioExists('shared.wav')).toBe(false);
        expect(library.add).not.toHaveBeenCalled();
        fetch.mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));
        await manager.preloadAudio('shared.wav');
        expect(fetch).toHaveBeenCalledTimes(2);
        const options = library.add.mock.calls[0][1] as { source: ArrayBuffer; url: string };
        expect(new Uint8Array(options.source)).toEqual(new Uint8Array([1, 2, 3]));
        expect(options.url).toBe('shared.wav');
        expect(manager.audioExists('shared.wav')).toBe(true);
        expect(external.destroy).not.toHaveBeenCalled();
    });

    it('aborts pending WebAudio fetch and allocates no resource even when its response arrives late', async () => {
        library.useLegacy = false;
        let resolve!: (response: Response) => void;
        const response = new Promise<Response>(done => { resolve = done; });
        const fetch = vi.spyOn(DOMAdapter.get(), 'fetch').mockReturnValue(response);
        const manager = new AudioManager();
        const pending = manager.playBgm('shared.wav', true);
        const rejected = expect(pending).rejects.toThrow('destroyed');
        const request = fetch.mock.calls[0][1] as RequestInit;
        manager.destroy();
        await rejected;
        expect(request.signal?.aborted).toBe(true);
        resolve(new Response(new Uint8Array([1, 2, 3])));
        for (let index = 0; index < 8; index++) await Promise.resolve();
        expect(library.add).not.toHaveBeenCalled();
        expect(library.play).not.toHaveBeenCalled();
    });

    it.each(['success', 'failure'])('keeps pending decoder media alive until %s, then disposes the retired resource exactly once', async outcome => {
        library.useLegacy = false;
        delayed = true;
        vi.spyOn(DOMAdapter.get(), 'fetch').mockResolvedValue(new Response(new Uint8Array([1])));
        const manager = new AudioManager();
        const pending = manager.preloadAudio('shared.wav');
        await vi.waitFor(() => expect(loads).toHaveLength(1));
        const owned = latestLoad('shared.wav');
        const rejected = expect(pending).rejects.toThrow('destroyed');
        manager.destroy();
        await rejected;
        expect(owned.resource.media).toBeDefined();
        expect(owned.resource.destroy).not.toHaveBeenCalled();
        owned.finish(outcome === 'failure' ? new Error('Decode failed') : undefined);
        owned.finish();
        expect(owned.resource.destroy).toHaveBeenCalledTimes(1);
        expect(aliases.has(owned.alias)).toBe(false);
    });

    it('fetches fresh bytes for a new manager using the same logical URL', async () => {
        library.useLegacy = false;
        const fetch = vi.spyOn(DOMAdapter.get(), 'fetch')
            .mockResolvedValueOnce(new Response(new Uint8Array([1])))
            .mockResolvedValueOnce(new Response(new Uint8Array([2])));
        const first = new AudioManager();
        await first.playBgm('shared.wav', true);
        const firstLoad = latestLoad('shared.wav');
        const second = new AudioManager();
        await second.playBgm('shared.wav', true);
        const secondLoad = latestLoad('shared.wav');
        const sources = library.add.mock.calls.map(([, options]) => new Uint8Array((options as { source: ArrayBuffer }).source));
        expect(sources).toEqual([new Uint8Array([1]), new Uint8Array([2])]);
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(firstLoad.alias).not.toBe(secondLoad.alias);
        first.destroy();
        expect(secondLoad.resource.instances).toHaveLength(1);
        expect(second.audioExists('shared.wav')).toBe(true);
        expect(secondLoad.resource.destroy).not.toHaveBeenCalled();
    });

    it('does not dispose a handle twice after external alias removal', async () => {
        const manager = new AudioManager();
        await manager.preloadAudio('shared.wav');
        const owned = latestLoad('shared.wav');
        library.remove(owned.alias);
        manager.destroy();
        expect(owned.resource.destroy).toHaveBeenCalledTimes(1);
    });
});

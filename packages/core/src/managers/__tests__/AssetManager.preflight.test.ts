import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@pixi/sound', async () => {
    const { createPixiSoundMock } = await import('../../test-utils/pixiSoundMock');
    return { sound: createPixiSoundMock() };
});

import type { MockInstance } from 'vitest';

import { sound } from '@pixi/sound';
import { Assets } from 'pixi.js';

import type { Script } from '../../types';

import { Logger } from '../../utils/Logger';
import { AssetManager } from '../AssetManager';
import { AudioManager } from '../AudioManager';
import { SceneManager } from '../SceneManager';
import { SpritesheetManager } from '../SpritesheetManager';

type SoundMock = {
    add: ReturnType<typeof vi.fn>;
    exists: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    play: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
};

const mockedSound = sound as unknown as SoundMock;
let load: MockInstance<typeof Assets.load>;

function createContext() {
    const audio = new AudioManager();
    const assets = new AssetManager(audio, new SpritesheetManager(), url => `resolved:${url}`);
    return { assets, audio };
}

describe('strict scene asset preflight', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.spyOn(Logger.prototype, 'info').mockImplementation(() => {});
        vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
        load = vi.spyOn(Assets, 'load').mockResolvedValue({});
        const aliases = new Map<string, { isLoaded: boolean }>();
        mockedSound.exists.mockImplementation((url: string) => aliases.has(url));
        mockedSound.find.mockImplementation((url: string) => aliases.get(url));
        mockedSound.remove.mockImplementation((url: string) => aliases.delete(url));
        mockedSound.add.mockReset();
        mockedSound.add.mockImplementation((url: string, options: { loaded?: (error?: Error) => void }) => {
            const loadedSound = { isLoaded: true };
            aliases.set(url, loadedSound);
            options.loaded?.();
            return loadedSound;
        });
        mockedSound.play.mockClear();
    });

    it('rejects actual texture loading failures for strict preflight and keeps navigation tolerant', async () => {
        const { assets } = createContext();
        load.mockRejectedValue(new Error('Texture failed'));
        const script = [{ assetUrl: 'background.png', type: 'background' }];
        await expect(assets.preloadSceneAssets(script)).resolves.toBeUndefined();
        await expect(assets.preloadSceneAssets(script, { strict: true })).rejects.toThrow('Texture failed');
        expect(load).toHaveBeenCalledWith('resolved:background.png');
    });

    it('rejects actual AudioManager loader failures and does not mark failed loads cached', async () => {
        const { assets } = createContext();
        mockedSound.add.mockImplementation((_url: string, options: { loaded?: (error?: Error) => void }) => { options.loaded?.(new Error('Audio failed')); });
        const script = [{ action: 'play', assetUrl: 'theme.mp3', type: 'bgm' }];
        await expect(assets.preloadSceneAssets(script)).resolves.toBeUndefined();
        await expect(assets.preloadSceneAssets(script, { strict: true })).rejects.toThrow('Audio failed');
        expect(mockedSound.add).toHaveBeenCalledTimes(2);
        expect(mockedSound.play).not.toHaveBeenCalled();
    });

    it('waits for a registered pending alias and fails strict restore before allowing a retry', async () => {
        const { assets } = createContext();
        const aliases = new Map<string, { isLoaded: boolean }>();
        let finish!: (error?: Error) => void;
        mockedSound.exists.mockImplementation((url: string) => aliases.has(url));
        mockedSound.find.mockImplementation((url: string) => aliases.get(url));
        mockedSound.remove.mockImplementation((url: string) => aliases.delete(url));
        mockedSound.add.mockImplementation((url: string, options: { loaded: (error?: Error) => void }) => {
            const pendingSound = { isLoaded: false };
            aliases.set(url, pendingSound);
            finish = error => { pendingSound.isLoaded = !error; options.loaded(error); };
            return pendingSound;
        });
        const script = [{ action: 'play', assetUrl: 'pending.mp3', type: 'bgm' }];
        const navigation = assets.preloadSceneAssets(script);
        let strictFinished = false;
        const strict = assets.preloadSceneAssets(script, { strict: true }).finally(() => { strictFinished = true; });
        const failure = expect(strict).rejects.toThrow('Pending audio failed');
        for (let index = 0; index < 8; index++) await Promise.resolve();
        expect(strictFinished).toBe(false);
        expect(mockedSound.add).toHaveBeenCalledTimes(1);
        finish(new Error('Pending audio failed'));
        await Promise.all([navigation, failure]);
        expect(aliases.size).toBe(0);
        const retry = assets.preloadSceneAssets(script, { strict: true });
        for (let index = 0; index < 8; index++) await Promise.resolve();
        finish();
        await retry;
        expect(mockedSound.add).toHaveBeenCalledTimes(2);
        expect(mockedSound.play).not.toHaveBeenCalled();
    });

    it('collects every choice branch and nested control body without treating cues as ordinary audio', () => {
        const script: Script = [{ options: [
            { commands: [{ commands: [{ assetUrl: 'choice.png', type: 'background' }], type: 'block' }], label: 'First' },
            { commands: [{ body: [{ assetUrl: 'choice.wav', type: 'sfx' }], type: 'for' }, { assetUrl: 'sound.sheet.json:click', type: 'sfx' }], label: 'Second' },
        ], type: 'choice' }];
        const extracted = AssetManager.extractAssetUrls(script);
        expect([...extracted.textures]).toEqual(['choice.png']);
        expect([...extracted.audio]).toEqual(['choice.wav']);
        expect([...AssetManager.extractAssetUrls(script, true).audio]).toEqual(['choice.wav', 'sound.sheet.json:click']);
    });

    it.each([
        { expected: 'assets/sfx/source.wav', source: 'source.wav' },
        { expected: '/absolute/source.wav', source: '/absolute/source.wav' },
        { expected: 'https://example.com/source.wav', source: 'https://example.com/source.wav' },
    ])('loads a cue descriptor and resolves $source without playback', async ({ expected, source }) => {
        const { assets, audio } = createContext();
        load.mockResolvedValue({ cues: { click: { start: 0 } }, source });
        const loadSheet = vi.spyOn(audio, 'loadAudiosheet');
        await assets.preloadSceneAssets([{ assetUrl: 'assets/sfx/sound.sheet.json:click', type: 'sfx' }], { strict: true });
        expect(load).toHaveBeenCalledWith('resolved:assets/sfx/sound.sheet.json');
        expect(loadSheet).toHaveBeenCalledExactlyOnceWith('assets/sfx/sound.sheet.json', { cues: { click: { start: 0 } }, source: `resolved:${expected}` });
        expect(mockedSound.add).toHaveBeenCalledWith(`resolved:${expected}`, expect.anything());
        expect(mockedSound.play).not.toHaveBeenCalled();
    });

    it.each([
        { descriptor: { cues: { click: { start: 0 } }, source: 'source.wav' }, error: 'Audio failed', kind: 'source' },
        { descriptor: {}, error: 'Invalid audiosheet', kind: 'schema' },
        { descriptor: { cues: {}, source: 'source.wav' }, error: 'missing', kind: 'cue' },
    ])('rejects cue $kind failures before playback', async ({ descriptor, error, kind }) => {
        const { assets } = createContext();
        load.mockResolvedValue(descriptor);
        if (kind === 'source') mockedSound.add.mockImplementation((_url: string, options: { loaded?: (error?: Error) => void }) => { options.loaded?.(new Error('Audio failed')); });
        await expect(assets.preloadSceneAssets([{ assetUrl: 'sound.sheet.json:click', type: 'sfx' }], { strict: true })).rejects.toThrow(error);
        expect(mockedSound.play).not.toHaveBeenCalled();
    });

    it('rejects descriptor load failure and preserves normal cue preloading behavior', async () => {
        const { assets } = createContext();
        load.mockRejectedValue(new Error('Descriptor failed'));
        const script = [{ assetUrl: 'sound.sheet.json:click', type: 'sfx' }];
        await expect(assets.preloadSceneAssets(script)).resolves.toBeUndefined();
        expect(load).not.toHaveBeenCalled();
        await expect(assets.preloadSceneAssets(script, { strict: true })).rejects.toThrow('Descriptor failed');
    });

    it('keeps current scene usable when its real strict texture preflight fails', async () => {
        const { assets } = createContext();
        const scenes = new SceneManager({ assets, events: { emit: vi.fn() }, logger: { error: vi.fn() } });
        scenes.loadScenes({ intro: [{ assetUrl: 'missing.png', type: 'background' }] });
        load.mockRejectedValue(new Error('Missing background'));
        await scenes.jumpToScene('intro');
        scenes.currentIndex = 1;
        await expect(scenes.prepareSaveRestore('intro', 0)).rejects.toThrow('Missing background');
        expect(scenes.currentSceneName).toBe('intro');
        expect(scenes.currentIndex).toBe(1);
        expect(scenes.script).toEqual([{ assetUrl: 'missing.png', type: 'background' }]);
    });
});

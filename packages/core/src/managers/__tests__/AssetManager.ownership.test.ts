import { Assets } from 'pixi.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { IAudioManager } from '../../interfaces/managers';

import { AssetManager } from '../AssetManager';
import { SpritesheetManager } from '../SpritesheetManager';

describe('shared asset ownership', () => {
    afterEach(() => vi.restoreAllMocks());

    it('does not evict cached textures used by a successor engine', async () => {
        const texture = { destroy: vi.fn() };
        const load = vi.spyOn(Assets, 'load').mockResolvedValue(texture);
        const unload = vi.spyOn(Assets, 'unload').mockResolvedValue();
        const audio = {} as IAudioManager;
        const old = new AssetManager(audio, new SpritesheetManager());
        const current = new AssetManager(audio, new SpritesheetManager());
        const script = [{ assetUrl: '/shared.png', type: 'background' }];
        await old.preloadSceneAssets(script);
        await current.preloadSceneAssets(script);
        old.destroy();
        expect(await current.load('/shared.png')).toBe(texture);
        expect(load).toHaveBeenCalledTimes(3);
        expect(unload).not.toHaveBeenCalled();
        expect(texture.destroy).not.toHaveBeenCalled();
        current.destroy();
        expect(unload).not.toHaveBeenCalled();
    });
});

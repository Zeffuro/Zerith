import { Container, Sprite, Texture } from 'pixi.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { IDisplayManager, ISpritesheetManager, IStateManager } from '../../interfaces/managers';
import type { SaveState } from '../../managers/SaveManager';

import { EventBus } from '../../managers/EventBus';
import { createAssetManagerMock, createLoggerMock } from '../../test-utils/audioHarness';
import { createDefaultSystemState } from '../../types';
import { SpriteHandler } from '../SpriteHandler';

function fixture() {
    const layer = new Container();
    const state = { system: createDefaultSystemState() } as IStateManager;
    const events = new EventBus();
    const assets = createAssetManagerMock({ load: <T>() => Promise.resolve(Texture.EMPTY as T) });
    const handler = new SpriteHandler(assets, { getLayer: () => layer, height: 720, width: 1280 } as unknown as IDisplayManager, events, createLoggerMock(), {} as ISpritesheetManager, state, () => ({}));
    return { events, handler, layer, state };
}

describe('sprite placement save and restore', () => {
    afterEach(() => vi.unstubAllGlobals());

    it.each(['instant', 'animated'] as const)('restores a scaled and flipped %s move after a ratio-sized show', async (mode) => {
        const { events, handler, layer, state } = fixture();
        if (mode === 'animated') vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(performance.now() + 1000); return 1; });
        await handler.execute({ action: 'show', assetUrl: '/assets/characters/clerk.png', fit: 'contain', heightRatio: 0.8, id: 'clerk', type: 'sprite', widthRatio: 0.25, xRatio: 0.5, yRatio: 1 });
        await handler.execute({ action: 'move', duration: mode === 'animated' ? 100 : 0, flip: true, id: 'clerk', scaleX: 2, scaleY: 3, type: 'sprite', x: 240, y: 500, zIndex: 7 });
        const slotText = JSON.stringify(state.system);
        const saved = JSON.parse(slotText) as SaveState['system'];
        expect(saved.sprites.clerk).toMatchObject({ flip: true, scaleX: -2, scaleY: 3, x: 240, y: 500, zIndex: 7 });
        expect(saved.sprites.clerk.widthRatio).toBeUndefined();
        expect(saved.sprites.clerk.heightRatio).toBeUndefined();
        expect(saved.sprites.clerk.fit).toBeUndefined();
        expect(saved.sprites.clerk.xRatio).toBeUndefined();
        expect(saved.sprites.clerk.yRatio).toBeUndefined();
        handler.reset();
        Object.assign(state.system, saved);
        events.emit('state:loaded', { index: 0, meta: { savedAt: 0, sceneName: 'intro', slot: 1 }, sceneName: 'intro', state: {}, system: saved });
        await vi.waitFor(() => expect(layer.children).toHaveLength(1));
        const restored = layer.children[0] as Sprite;
        expect({ scaleX: restored.scale.x, scaleY: restored.scale.y, x: restored.x, y: restored.y, zIndex: restored.zIndex }).toEqual({ scaleX: -2, scaleY: 3, x: 240, y: 500, zIndex: 7 });
        handler.destroy();
    });

    it('preserves ratio sizing for a move that only changes position', async () => {
        const { handler, state } = fixture();
        await handler.execute({ action: 'show', assetUrl: '/assets/characters/clerk.png', fit: 'contain', heightRatio: 0.8, id: 'clerk', type: 'sprite', widthRatio: 0.25 });
        await handler.execute({ action: 'move', id: 'clerk', transition: 'instant', type: 'sprite', x: 240 });
        expect(state.system.sprites.clerk).toMatchObject({ fit: 'contain', heightRatio: 0.8, widthRatio: 0.25, x: 240 });
        handler.destroy();
    });

    it('clears ratio sizing when only one explicit scale axis is supplied', async () => {
        const { handler, layer, state } = fixture();
        await handler.execute({ action: 'show', assetUrl: '/assets/characters/clerk.png', heightRatio: 0.8, id: 'clerk', type: 'sprite', widthRatio: 0.25 });
        const originalScaleX = layer.children[0].scale.x;
        await handler.execute({ action: 'move', id: 'clerk', scaleY: 3, transition: 'instant', type: 'sprite' });
        expect(state.system.sprites.clerk).toMatchObject({ scaleX: originalScaleX, scaleY: 3 });
        expect(state.system.sprites.clerk.widthRatio).toBeUndefined();
        expect(state.system.sprites.clerk.heightRatio).toBeUndefined();
        handler.destroy();
    });
});

import type { Engine } from '@zeffuro/zerith-core';

import { describe, expect, it, vi } from 'vitest';

import { useEditorStore } from '../../store/useEditorStore';
import { usePlaytestStore } from '../../store/usePlaytestStore';
import { startPlaytest } from '../playtests/playtestRuntime';

vi.mock('@zeffuro/zerith-core', () => ({ deepClone: structuredClone, WEATHER_PRESET_DEFAULTS: {} }));

const scenario = { choices: [], expectedState: {}, id: 'evening', index: 1, inventory: ['ticket'], name: 'Evening shift', scene: 'station', state: { trust: 1 } };

function fixture() {
    const calls: string[] = [];
    let loaded: (() => void) | undefined;
    const engine = {
        clear: vi.fn(() => calls.push('clear')),
        flow: { stop: vi.fn(() => calls.push('stop')) },
        items: { add: vi.fn(() => { calls.push('inventory'); return true; }) },
        scenes: { jumpToScene: vi.fn(() => new Promise<void>(resolve => { loaded = resolve; calls.push('scene'); })), loadScenes: vi.fn(() => calls.push('scenes')) },
        setInputEnabled: vi.fn(),
        start: vi.fn(() => calls.push('start')),
        stateManager: { replaceState: vi.fn(() => calls.push('state')) },
    };
    return { calls, engine, loaded: () => loaded?.() };
}

describe('playtest launch', () => {
    it.each(['triggerStop', 'triggerPlay', 'triggerPlayFrom'] as const)('cancels a pending scenario immediately on %s', async action => {
        const { engine, loaded } = fixture();
        usePlaytestStore.getState().launch('/station', scenario, false);
        const request = usePlaytestStore.getState().request;
        const pending = startPlaytest(engine as unknown as Engine, scenario, {}, () => usePlaytestStore.getState().request === request);
        useEditorStore.getState()[action](0);
        loaded(); await pending;
        expect(engine.start).not.toHaveBeenCalled();
        expect(usePlaytestStore.getState().request).toBeUndefined();
    });
    it('sets initial variables and inventory after clear and before the scene starts', async () => {
        const { calls, engine, loaded } = fixture();
        const pending = startPlaytest(engine as unknown as Engine, scenario, {}, () => true);
        expect(engine.stateManager.replaceState).toHaveBeenCalledWith({ trust: 1 });
        expect(engine.scenes.jumpToScene).toHaveBeenCalledWith('station', 1);
        expect(engine.start).not.toHaveBeenCalled();
        loaded(); await pending;
        expect(calls).toEqual(['stop', 'clear', 'scenes', 'state', 'inventory', 'scene', 'start']);
    });

    it('does not start a superseded preview after assets finish loading', async () => {
        const { engine, loaded } = fixture(); let current = true;
        const pending = startPlaytest(engine as unknown as Engine, scenario, {}, () => current);
        current = false; loaded(); await pending;
        expect(engine.start).not.toHaveBeenCalled();
    });

    it('does not clear an unrelated runtime or continue after an unknown item', async () => {
        const { engine } = fixture();
        await startPlaytest(engine as unknown as Engine, scenario, {}, () => false);
        expect(engine.clear).not.toHaveBeenCalled();
        engine.items.add.mockReturnValue(false);
        await expect(startPlaytest(engine as unknown as Engine, scenario, {}, () => true)).rejects.toThrow('ticket');
        expect(engine.scenes.jumpToScene).not.toHaveBeenCalled();
        expect(engine.start).not.toHaveBeenCalled();
    });
});

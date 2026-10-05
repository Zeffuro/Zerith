import { describe, expect, it, vi } from 'vitest';

import type { Engine } from '../../Engine';

import { EventBus } from '../../managers/EventBus';
import { bindDefaultInputEvents } from '../bindDefaultInputEvents';

describe('default save input errors', () => {
    it('shows an unsafe capture error instead of throwing from the keyboard event', () => {
        const events = new EventBus();
        const show = vi.fn();
        bindDefaultInputEvents({ events, flow: {}, notifications: { show }, saves: { save: () => { throw new Error('Wait for command'); } } } as unknown as Engine);
        expect(() => events.emit('input:save', 1)).not.toThrow();
        expect(show).toHaveBeenCalledExactlyOnceWith('Wait for command');
    });

    it('shows rejected loads and keeps the event listener usable for a later successful load', async () => {
        const events = new EventBus();
        const show = vi.fn();
        const applySaveState = vi.fn().mockRejectedValueOnce(new Error('Content changed')).mockImplementationOnce(() => Promise.resolve());
        bindDefaultInputEvents({ applySaveState, events, flow: {}, notifications: { show }, saves: { load: vi.fn(() => Promise.resolve({})) } } as unknown as Engine);
        events.emit('input:load', 1);
        await vi.waitFor(() => expect(show).toHaveBeenCalledWith('Content changed'));
        events.emit('input:load', 1);
        await vi.waitFor(() => expect(show).toHaveBeenLastCalledWith('Game Loaded!'));
    });
});

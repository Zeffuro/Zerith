import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IDisplayManager, IFlowManager } from '../../interfaces/managers';

import { EventBus } from '../../managers/EventBus';
import { ChoiceHandler } from '../ChoiceHandler';

vi.mock('../choice/ChoiceRenderer', () => ({ ChoiceRenderer: class {
    create() {}
    destroy() {}
    setSelected() {}
} }));

describe('choice recording and replay', () => {
    beforeEach(() => { vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 0; }); });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('replays an available option and records its index and label once', async () => {
        const events = new EventBus();
        const injectCommands = vi.fn();
        const consumeSkip = vi.fn();
        const completePresentation = vi.fn();
        const handler = new ChoiceHandler({} as IDisplayManager, events, { completePresentation, consumeSkip, injectCommands } as unknown as IFlowManager);
        const selected = vi.fn();
        events.on('choice:selected', selected);
        events.on('choice:shown', () => { events.emit('input:choose', 1); events.emit('input:choose', 1); });
        await handler.execute({ options: [{ label: 'Ask the clerk' }, { commands: [{ name: 'platform', type: 'label' }], label: 'Check the platform' }], type: 'choice' });
        expect(selected).toHaveBeenCalledExactlyOnceWith(1, 'Check the platform');
        expect(completePresentation).toHaveBeenCalledExactlyOnceWith('choice');
        expect(completePresentation.mock.invocationCallOrder[0]).toBeLessThan(selected.mock.invocationCallOrder[0]);
        expect(injectCommands).toHaveBeenCalledOnce();
        handler.destroy();
        events.emit('input:choose', 0);
        expect(selected).toHaveBeenCalledOnce();
    });

    it('ignores stale and invalid choices and detaches replay controls on reset', async () => {
        const events = new EventBus();
        const handler = new ChoiceHandler({} as IDisplayManager, events, { consumeSkip: vi.fn(), injectCommands: vi.fn() } as unknown as IFlowManager);
        const selected = vi.fn(); events.on('choice:selected', selected);
        const pending = handler.execute({ options: [{ label: 'Ask the clerk' }], type: 'choice' });
        events.emit('input:choose', -1); events.emit('input:choose', 0.5); events.emit('input:choose', 1);
        expect(selected).not.toHaveBeenCalled();
        handler.reset(); await pending;
        events.emit('input:choose', 0);
        expect(selected).not.toHaveBeenCalled();
    });

    it('keeps a newer choice resettable when an older confirmation frame arrives', async () => {
        const frames: FrameRequestCallback[] = [];
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
        const events = new EventBus();
        const consumeSkip = vi.fn();
        const handler = new ChoiceHandler({} as IDisplayManager, events, { consumeSkip, injectCommands: vi.fn() } as unknown as IFlowManager);
        const first = handler.execute({ options: [{ label: 'Ask the clerk' }], type: 'choice' });
        events.emit('input:choose', 0);
        let secondResolved = false;
        const second = handler.execute({ options: [{ label: 'Check the platform' }], type: 'choice' }).then(() => { secondResolved = true; });
        frames.shift()?.(0);
        await first;
        handler.reset();
        await Promise.resolve();
        expect(secondResolved).toBe(true);
        expect(consumeSkip).not.toHaveBeenCalled();
        await second;
    });
});

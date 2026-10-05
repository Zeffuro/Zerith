import { describe, expect, it, vi } from 'vitest';

import { createFlowManagerHarness, flushAsync } from '../../test-utils/flowManagerHarness';
import { scriptOf, waitCommand } from '../../test-utils/scriptBuilders';

function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>(done => { resolve = done; });
    return { promise, resolve };
}

describe('flow execution ownership', () => {
    it('keeps the newer command pending when a stopped command finishes', async () => {
        const first = deferred();
        const second = deferred();
        const context = createFlowManagerHarness(scriptOf(waitCommand(), waitCommand()));
        const execute = vi.fn(() => Promise.resolve()).mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
        context.flow.registerHandler({ autoNext: true, execute, type: 'wait' });
        context.flow.start();
        context.flow.stop();
        context.scenes.currentIndex = 0;
        context.flow.start();
        first.resolve();
        await flushAsync();
        await context.flow.playNext();
        expect(execute).toHaveBeenCalledTimes(2);
        expect(context.scenes.currentIndex).toBe(1);
        second.resolve();
        await flushAsync();
        await flushAsync();
        expect(execute).toHaveBeenCalledTimes(3);
        expect(context.scenes.currentIndex).toBe(2);
    });

    it('does not announce navigation from a stopped command', async () => {
        const pending = deferred();
        const context = createFlowManagerHarness([{ to: 'platform', type: 'jump' }]);
        context.flow.registerHandler({ autoNext: true, execute: vi.fn(() => pending.promise), type: 'jump' });
        context.flow.start();
        context.flow.stop();
        context.scenes.script = [];
        context.flow.start();
        pending.resolve();
        await flushAsync();
        await flushAsync();
        expect(context.emitted.filter(entry => entry.event === 'flow:scene_entered')).toEqual([]);
    });
});

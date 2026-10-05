import { afterEach, describe, expect, it, vi } from 'vitest';

import { WaitHandler } from '../../handlers/WaitHandler';
import { createFlowManagerHarness, flushAsync } from '../../test-utils/flowManagerHarness';
import { scriptOf, waitCommand } from '../../test-utils/scriptBuilders';

async function settle() {
    for (let index = 0; index < 8; index++) await flushAsync();
}

describe('runtime flow suspension', () => {
    afterEach(() => vi.useRealTimers());

    it('holds an automatic continuation after a real timed wait finishes', async () => {
        vi.useFakeTimers();
        const context = createFlowManagerHarness([
            { duration: 100, type: 'wait' },
            { duration: 0, type: 'wait' },
        ]);
        const handler = new WaitHandler();
        const execute = vi.fn(handler.execute);
        context.flow.registerHandler({ autoNext: true, execute, type: 'wait' });
        context.flow.start();
        const release = context.flow.acquireSuspension();
        await vi.advanceTimersByTimeAsync(100);
        expect(execute).toHaveBeenCalledTimes(1);
        expect(context.scenes.currentIndex).toBe(1);
        release();
        await settle();
        expect(execute).toHaveBeenCalledTimes(2);
        expect(context.scenes.currentIndex).toBe(2);
    });

    it('requires every nested token and ignores duplicate releases', async () => {
        const context = createFlowManagerHarness(scriptOf(waitCommand(), waitCommand()));
        const first = context.flow.acquireSuspension();
        const second = context.flow.acquireSuspension();
        context.flow.start();
        await settle();
        first();
        first();
        await settle();
        expect(context.execute).not.toHaveBeenCalled();
        second();
        await settle();
        expect(context.execute).toHaveBeenCalledTimes(2);
    });

    it('does not advance an idle manual dialogue on release or queued input', async () => {
        const context = createFlowManagerHarness([
            { speaker: 'Narrator', text: 'Wait here.', type: 'dialogue' },
            waitCommand(),
        ]);
        const dialogue = vi.fn(async () => {});
        context.flow.registerHandler({ autoNext: false, execute: dialogue, type: 'dialogue' });
        context.flow.start();
        await settle();
        const release = context.flow.acquireSuspension();
        await context.flow.playNext();
        release();
        await settle();
        expect(context.scenes.currentIndex).toBe(1);
        expect(context.execute).not.toHaveBeenCalled();
        await context.flow.playNext();
        expect(context.execute).toHaveBeenCalledTimes(1);
    });

    it('preserves a debug pause acquired during suspension', async () => {
        const context = createFlowManagerHarness(scriptOf(waitCommand()));
        const release = context.flow.acquireSuspension();
        context.flow.start();
        context.flow.pause();
        release();
        await settle();
        expect(context.flow.isPaused).toBe(true);
        expect(context.execute).not.toHaveBeenCalled();
        context.flow.resume();
        await settle();
        expect(context.execute).toHaveBeenCalledTimes(1);
    });

    it('cancels old waiters on reset while keeping a live menu token', async () => {
        const context = createFlowManagerHarness(scriptOf(waitCommand()));
        const release = context.flow.acquireSuspension();
        context.flow.start();
        await settle();
        context.flow.stop();
        context.scenes.script = scriptOf(waitCommand(), waitCommand());
        context.scenes.currentIndex = 0;
        context.flow.start();
        await settle();
        expect(context.execute).not.toHaveBeenCalled();
        release();
        await settle();
        expect(context.execute).toHaveBeenCalledTimes(2);
        expect(context.scenes.currentIndex).toBe(2);
    });

    it('cancels direct nested commands and waiting playback on destruction', async () => {
        const context = createFlowManagerHarness(scriptOf(waitCommand()));
        const release = context.flow.acquireSuspension();
        context.flow.start();
        const direct = context.flow.runCommand(waitCommand());
        context.flow.destroy();
        await direct;
        release();
        await settle();
        expect(context.execute).not.toHaveBeenCalled();
        expect(context.flow.isStarted).toBe(false);
    });

    it('holds direct nested commands until release', async () => {
        const context = createFlowManagerHarness([]);
        const release = context.flow.acquireSuspension();
        const pending = context.flow.runCommand(waitCommand());
        await settle();
        expect(context.execute).not.toHaveBeenCalled();
        release();
        await pending;
        expect(context.execute).toHaveBeenCalledTimes(1);
    });
});

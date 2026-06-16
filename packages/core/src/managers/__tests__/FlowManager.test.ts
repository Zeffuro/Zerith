import { describe, expect, it, vi } from 'vitest';

import { createFlowManagerHarness, flushAsync } from '../../test-utils/flowManagerHarness';
import { scriptOf, waitCommand } from '../../test-utils/scriptBuilders';

describe('FlowManager', () => {
    it('start() executes script commands and stop() resets started state', async () => {
        const context = createFlowManagerHarness(scriptOf(waitCommand(), waitCommand()));

        context.flow.start();
        await flushAsync();

        expect(context.execute).toHaveBeenCalledTimes(2);
        expect(context.scenes.currentIndex).toBe(2);
        expect(context.emitted.filter((entry) => entry.event === 'flow:command')).toHaveLength(2);

        context.flow.stop();
        expect(context.flow.isStarted).toBe(false);
        expect(context.flow.isPaused).toBe(false);
    });

    it('pause() and resume() emit paused/resumed events when started', async () => {
        const context = createFlowManagerHarness([]);

        context.flow.start();
        await flushAsync();

        context.flow.pause();
        context.flow.resume();
        await flushAsync();

        expect(context.emitted.some((entry) => entry.event === 'flow:paused')).toBe(true);
        expect(context.emitted.some((entry) => entry.event === 'flow:resumed')).toBe(true);
    });

    it('step() runs one injected command then pauses again', async () => {
        const context = createFlowManagerHarness([]);

        context.flow.start();
        await flushAsync();
        context.flow.pause();
        context.flow.injectCommands([waitCommand()]);

        context.flow.step();
        await flushAsync();

        expect(context.execute).toHaveBeenCalledTimes(1);
        expect(context.emitted.some((entry) => entry.event === 'flow:stepped')).toBe(true);
        expect(context.emitted.filter((entry) => entry.event === 'flow:paused').length).toBeGreaterThan(0);
        expect(context.flow.isPaused).toBe(true);
    });

    it('stops after an injected non-autoNext command', async () => {
        const context = createFlowManagerHarness([]);
        const executeDialogue = vi.fn(async () => {});

        context.flow.registerHandler({
            autoNext: false,
            execute: executeDialogue,
            type: 'dialogue',
        });

        context.flow.start();
        await flushAsync();

        context.flow.injectCommands([
            { speaker: 'Narrator', text: 'Hold here.', type: 'dialogue' },
            waitCommand(),
        ]);
        await context.flow.playNext();

        expect(executeDialogue).toHaveBeenCalledTimes(1);
        expect(context.execute).not.toHaveBeenCalled();

        await context.flow.playNext();

        expect(context.execute).toHaveBeenCalledTimes(1);
    });
});

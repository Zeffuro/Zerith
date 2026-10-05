import { Container, HTMLText, Text } from 'pixi.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createFlowManagerHarness, flushAsync } from '../../test-utils/flowManagerHarness';
import { waitCommand } from '../../test-utils/scriptBuilders';
import { createDefaultSystemState } from '../../types';
import { DialogueHandler } from '../DialogueHandler';

function fixture(instant = false) {
    const command = { instant, speaker: 'Narrator', text: 'Visible line.', type: 'dialogue' as const };
    const context = createFlowManagerHarness([command, waitCommand()]);
    const layers = { sprites: new Container(), ui: new Container() };
    const history = { push: vi.fn() };
    const state = { system: createDefaultSystemState() };
    const handler = new DialogueHandler(
        {} as never, {} as never, {} as never,
        { getLayer: (name: keyof typeof layers) => layers[name], height: 720, width: 1280 } as never,
        {} as never, context.flow, history as never, { warn: vi.fn() } as never, state as never,
        { messageStyle: { fontSize: 24 }, nameStyle: { fontSize: 28 }, typewriterSpeed: 0 },
    );
    context.flow.registerHandler(handler);
    return { ...context, command, handler, history, layers, state };
}

async function settle() {
    for (let index = 0; index < 8; index++) await flushAsync();
}

describe('dialogue playback preferences', () => {
    afterEach(() => vi.useRealTimers());

    it('replays saved presentation without duplicating history or consuming pending commands', async () => {
        const context = fixture(true);
        context.flow.start();
        await settle();
        context.flow.resetHandlers();
        context.flow.reset();
        context.flow.restoreSaveContinuation({ injectedCommands: [], nextIndex: 1,
            replay: { command: context.command, kind: 'dialogue' },
            runtimeScript: [{ command: context.command, kind: 'original', originalIndex: 0 }], sourceFingerprint: 'fixture' });
        context.flow.start();
        await settle();
        expect(context.history.push).toHaveBeenCalledTimes(1);
        expect(context.execute).not.toHaveBeenCalled();
        expect(context.state.system.dialogue?.text).toBe('Visible line.');
        context.flow.destroy();
    });

    it.each([false, true])('advances %s instant dialogue through real flow after its delay', async (instant) => {
        vi.useFakeTimers();
        const context = fixture(instant);
        context.handler.setAutoAdvanceDelay(100);
        context.flow.start();
        await settle();
        expect(context.history.push).toHaveBeenCalledTimes(1);
        expect(context.execute).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(99);
        expect(context.execute).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        await settle();
        expect(context.execute).toHaveBeenCalledTimes(1);
        expect(context.scenes.currentIndex).toBe(2);
        context.flow.destroy();
    });

    it('does not advance when auto mode is disabled and reenabled during its delay', async () => {
        vi.useFakeTimers();
        const context = fixture(true);
        context.handler.setAutoAdvanceDelay(100);
        context.flow.start();
        await settle();
        await vi.advanceTimersByTimeAsync(50);
        context.handler.setAutoAdvanceDelay(undefined);
        context.handler.setAutoAdvanceDelay(100);
        await vi.advanceTimersByTimeAsync(100);
        await settle();
        expect(context.handler.autoNext).toBe(false);
        expect(context.execute).not.toHaveBeenCalled();
        expect(context.scenes.currentIndex).toBe(1);
        context.flow.destroy();
    });

    it('holds automatic dialogue at the suspension boundary and honors disabling it there', async () => {
        vi.useFakeTimers();
        const context = fixture(true);
        context.handler.setAutoAdvanceDelay(100);
        context.flow.start();
        await settle();
        const release = context.flow.acquireSuspension();
        await vi.advanceTimersByTimeAsync(100);
        expect(context.handler.autoNext).toBe(true);
        expect(context.execute).not.toHaveBeenCalled();
        context.handler.setAutoAdvanceDelay(undefined);
        release();
        await settle();
        expect(context.execute).not.toHaveBeenCalled();
        expect(context.scenes.currentIndex).toBe(1);
        context.flow.destroy();
    });

    it('resumes delayed automatic dialogue after closing a suspended menu', async () => {
        vi.useFakeTimers();
        const context = fixture(true);
        context.handler.setAutoAdvanceDelay(100);
        context.flow.start();
        await settle();
        const release = context.flow.acquireSuspension();
        await vi.advanceTimersByTimeAsync(100);
        expect(context.execute).not.toHaveBeenCalled();
        release();
        await settle();
        expect(context.execute).toHaveBeenCalledTimes(1);
        context.flow.destroy();
    });

    it('changes live text size without clearing dialogue, replacing nodes or adding history', async () => {
        const context = fixture(true);
        await context.handler.execute(context.command);
        const panel = context.layers.ui.children[0];
        const name = panel.children.find(child => child instanceof Text && !(child instanceof HTMLText)) as Text;
        const message = panel.children.find(child => child instanceof HTMLText) as HTMLText;
        const snapshot = { ...context.state.system.dialogue };
        context.handler.setTextSize(36);
        expect(context.layers.ui.children[0]).toBe(panel);
        expect(message.text).toBe('Visible line.');
        expect(message.style.fontSize).toBe(36);
        expect(name.text).toBe('Narrator');
        expect(name.style.fontSize).toBe(42);
        expect(context.state.system.dialogue).toEqual(snapshot);
        expect(context.history.push).toHaveBeenCalledTimes(1);
        context.flow.destroy();
    });

    it('applies text size before UI creation and rejects nonfinite sizes', async () => {
        const context = fixture(true);
        context.handler.setTextSize(32);
        context.handler.setTextSize(Number.NaN);
        await context.handler.execute(context.command);
        const panel = context.layers.ui.children[0];
        const message = panel.children.find(child => child instanceof HTMLText) as HTMLText;
        expect(message.style.fontSize).toBe(32);
        context.flow.destroy();
    });

    it('starts auto mode from a completed manual line after its delay and menu release', async () => {
        vi.useFakeTimers();
        const context = fixture(true);
        context.flow.start();
        await settle();
        const release = context.flow.acquireSuspension();
        context.handler.setAutoAdvanceDelay(100);
        await vi.advanceTimersByTimeAsync(99);
        expect(context.execute).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(context.execute).not.toHaveBeenCalled();
        release();
        await settle();
        expect(context.execute).toHaveBeenCalledTimes(1);
        expect(context.history.push).toHaveBeenCalledTimes(1);
        context.flow.destroy();
    });

    it('cancels an idle continuation when disabled and starts a fresh delay on reenable', async () => {
        vi.useFakeTimers();
        const context = fixture(true);
        context.flow.start();
        await settle();
        const release = context.flow.acquireSuspension();
        context.handler.setAutoAdvanceDelay(100);
        await vi.advanceTimersByTimeAsync(100);
        context.handler.setAutoAdvanceDelay(undefined);
        context.handler.setAutoAdvanceDelay(100);
        release();
        await settle();
        expect(context.execute).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(99);
        expect(context.execute).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        await settle();
        expect(context.execute).toHaveBeenCalledTimes(1);
        context.flow.destroy();
    });

    it('preserves debugger pause when the automatic continuation is suspended', async () => {
        vi.useFakeTimers();
        const context = fixture(true);
        context.flow.start();
        await settle();
        const release = context.flow.acquireSuspension();
        context.handler.setAutoAdvanceDelay(100);
        await vi.advanceTimersByTimeAsync(100);
        context.flow.pause();
        release();
        await settle();
        expect(context.flow.isPaused).toBe(true);
        expect(context.execute).not.toHaveBeenCalled();
        context.flow.resume();
        await settle();
        expect(context.execute).toHaveBeenCalledTimes(1);
        context.flow.destroy();
    });

    it('does not advance an unfinished or idle choice from stale dialogue preferences', async () => {
        vi.useFakeTimers();
        const context = fixture(true);
        const choice = { choices: [], type: 'choice' as const };
        context.scenes.script = [context.command, choice, waitCommand()];
        let finishChoice!: () => void;
        const pending = new Promise<void>(resolve => { finishChoice = resolve; });
        const executeChoice = vi.fn(() => pending);
        context.flow.registerHandler({ autoNext: false, execute: executeChoice, type: 'choice' });
        context.flow.start();
        await settle();
        void context.flow.playNext();
        await settle();
        context.handler.setAutoAdvanceDelay(100);
        await vi.advanceTimersByTimeAsync(100);
        expect(executeChoice).toHaveBeenCalledTimes(1);
        expect(context.execute).not.toHaveBeenCalled();
        finishChoice();
        await settle();
        context.handler.setAutoAdvanceDelay(undefined);
        context.handler.setAutoAdvanceDelay(100);
        await vi.advanceTimersByTimeAsync(100);
        await settle();
        expect(context.execute).not.toHaveBeenCalled();
        expect(context.scenes.currentIndex).toBe(2);
        context.flow.destroy();
    });

    it.each(['reset', 'destroy'] as const)('cancels an idle automatic continuation on %s', async (action) => {
        vi.useFakeTimers();
        const context = fixture(true);
        context.flow.start();
        await settle();
        const release = context.flow.acquireSuspension();
        context.handler.setAutoAdvanceDelay(100);
        await vi.advanceTimersByTimeAsync(100);
        context.flow[action]();
        release();
        await settle();
        expect(context.execute).not.toHaveBeenCalled();
        context.flow.destroy();
    });
});

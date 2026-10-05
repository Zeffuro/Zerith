import { describe, expect, it, vi } from 'vitest';

import type { BaseCommand } from '../../types';

import { BlockHandler } from '../../handlers/BlockHandler';
import { CallHandler } from '../../handlers/CallHandler';
import { ForHandler } from '../../handlers/ForHandler';
import { GotoHandler } from '../../handlers/GotoHandler';
import { IfHandler } from '../../handlers/IfHandler';
import { SetHandler } from '../../handlers/SetHandler';
import { WhileHandler } from '../../handlers/WhileHandler';
import { Logger } from '../../utils/Logger';
import { EventBus } from '../EventBus';
import { EvidenceManager } from '../EvidenceManager';
import { FlowManager } from '../FlowManager';
import { SceneManager } from '../SceneManager';
import { StateManager } from '../StateManager';

const dialogue = (text: string): BaseCommand => ({ speaker: 'Guide', text, type: 'dialogue' });

async function createContext(script: BaseCommand[]) {
    const events = new EventBus();
    const logger = new Logger('[Continuation test]');
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    const scenes = new SceneManager({ assets: { preloadSceneAssets: vi.fn(async () => {}) }, events, logger });
    scenes.loadScenes({ intro: script });
    await scenes.jumpToScene('intro');
    const flow = new FlowManager({ events, handlers: new Map(), logger, scenes });
    const seen: string[] = [];
    const restored: boolean[] = [];
    const state = new StateManager(events);
    const items = new EvidenceManager();
    flow.registerHandler({ autoNext: false, execute: command => { seen.push(String(command.text)); restored.push(flow.isRestoringPresentation); }, type: 'dialogue' });
    flow.registerHandlers([
        new CallHandler(logger, scenes, flow), new BlockHandler(flow), new SetHandler(state),
        new IfHandler(flow, items, state), new ForHandler(flow), new WhileHandler(flow, logger, items, state), new GotoHandler(logger, scenes),
    ]);
    return { events, flow, restored, scenes, seen, state };
}

async function reload(context: Awaited<ReturnType<typeof createContext>>) {
    const saved = context.flow.captureSaveContinuation();
    const state = structuredClone(context.state.state);
    context.flow.stop();
    const prepared = await context.scenes.prepareSaveRestore('intro', 0, saved);
    context.scenes.cancelSceneLoad();
    context.scenes.commitSaveRestore(prepared);
    context.state.replaceState(state);
    context.flow.restoreSaveContinuation(saved);
    context.flow.start();
    await settle();
    return saved;
}

async function settle() {
    for (let index = 0; index < 30; index++) await Promise.resolve();
}

const increment: BaseCommand = { key: 'count', op: 'add', type: 'set', value: 1 };

describe('flow save continuation', () => {
    it('replays the current macro dialogue then resumes its exact tail before the root', async () => {
        const context = await createContext([{ name: 'greeting', type: 'call' }, dialogue('Root after')]);
        context.scenes.registerTemplate('greeting', [dialogue('Macro first'), dialogue('Macro second')]);
        context.flow.start();
        await settle();
        expect(context.seen).toEqual(['Macro first']);
        const saved = context.flow.captureSaveContinuation();
        context.flow.stop();
        const prepared = await context.scenes.prepareSaveRestore('intro', 0, saved);
        context.scenes.commitSaveRestore(prepared);
        context.flow.restoreSaveContinuation(saved);
        context.flow.start();
        await settle();
        expect(context.seen).toEqual(['Macro first', 'Macro first']);
        await context.flow.playNext();
        await context.flow.playNext();
        expect(context.seen).toEqual(['Macro first', 'Macro first', 'Macro second', 'Root after']);
        expect(context.restored).toEqual([false, true, false, false]);
    });

    it.each([
        { command: { commands: [increment, { key: 'count', onTrue: [dialogue('First'), increment, dialogue('Second')], type: 'if', value: 1 }], type: 'block' }, expected: ['First', 'First', 'Second', 'Root after'], name: 'if inside block' },
        { command: { body: [increment, dialogue('First'), dialogue('Second')], from: 1, iterator: 'iteration', to: 2, type: 'for' }, expected: ['First', 'First', 'Second', 'First', 'Second', 'Root after'], name: 'for generated iterator tail' },
        { command: { body: [increment, dialogue('First'), dialogue('Second')], key: 'count', maxIterations: 4, op: 'lt', type: 'while', value: 2 }, expected: ['First', 'First', 'Second', 'First', 'Second', 'Root after'], name: 'while decremented budget' },
    ])('preserves $name without repeating completed effects', async ({ command, expected }) => {
        const context = await createContext([command, dialogue('Root after')]);
        context.state.set('count', 0);
        context.flow.start();
        await settle();
        expect(context.state.get('count')).toBe(1);
        const saved = await reload(context);
        expect(saved.replay?.command.text).toBe('First');
        for (let index = 0; index < expected.length; index++) await context.flow.playNext();
        expect(context.seen).toEqual(expected);
        expect(context.state.get('count')).toBe(2);
        if (command.type === 'for') expect(context.state.get('iteration')).toBe(2);
        if (command.type === 'while') expect(saved.injectedCommands.at(-1)?.maxIterations).toBe(3);
    });

    it('preserves nested macro calls and their outer tails', async () => {
        const context = await createContext([{ name: 'outer', type: 'call' }, dialogue('Root after')]);
        context.scenes.registerTemplate('outer', [increment, { name: 'inner', type: 'call' }, dialogue('Outer after')]);
        context.scenes.registerTemplate('inner', [dialogue('First'), increment, dialogue('Second')]);
        context.flow.start();
        await settle();
        await reload(context);
        for (let index = 0; index < 4; index++) await context.flow.playNext();
        expect(context.seen).toEqual(['First', 'First', 'Second', 'Outer after', 'Root after']);
        expect(context.state.get('count')).toBe(2);
    });

    it('preserves both injection stores and backward runtime label navigation', async () => {
        const context = await createContext([{ name: 'start', type: 'label' }, dialogue('Root'), { label: 'start', type: 'goto' }]);
        context.scenes.injectCommands([dialogue('Scene injected')]);
        context.flow.injectCommands([dialogue('Flow first'), dialogue('Flow second')]);
        context.flow.start();
        await settle();
        const saved = await reload(context);
        expect(saved.runtimeScript[0].kind).toBe('injected');
        expect(saved.nextIndex).toBe(0);
        await context.flow.playNext();
        await context.flow.playNext();
        await context.flow.playNext();
        await context.flow.playNext();
        expect(context.seen).toEqual(['Flow first', 'Flow first', 'Flow second', 'Scene injected', 'Root', 'Root']);
    });

    it('replays a pending choice and resumes a selected body without selecting again', async () => {
        const context = await createContext([{ options: [{ commands: [increment, dialogue('Body first'), dialogue('Body second')], label: 'Select' }], type: 'choice' }, dialogue('Root after')]);
        let finishChoice!: () => void;
        let choices = 0;
        context.flow.registerHandler({ autoNext: true, execute: () => { choices++; return new Promise<void>(resolve => { finishChoice = resolve; }); }, type: 'choice' });
        context.flow.start();
        await settle();
        const savedChoice = context.flow.captureSaveContinuation();
        expect(savedChoice.replay?.kind).toBe('choice');
        context.flow.stop();
        finishChoice();
        const prepared = await context.scenes.prepareSaveRestore('intro', 0, savedChoice);
        context.scenes.commitSaveRestore(prepared);
        context.flow.restoreSaveContinuation(savedChoice);
        context.flow.start();
        await settle();
        expect(choices).toBe(2);
        context.flow.completePresentation('choice');
        expect(() => context.flow.captureSaveContinuation()).toThrow('Wait for the current command');
        context.flow.injectCommands([increment, dialogue('Body first'), dialogue('Body second')]);
        finishChoice();
        await settle();
        const body = await reload(context);
        expect(body.replay?.kind).toBe('dialogue');
        await context.flow.playNext();
        await context.flow.playNext();
        expect(choices).toBe(2);
        expect(context.state.get('count')).toBe(1);
        expect(context.seen).toEqual(['Body first', 'Body first', 'Body second', 'Root after']);
    });

    it('rejects capture during unsupported effects and does not leak restored state across resets', async () => {
        const context = await createContext([{ duration: 1, type: 'wait' }, dialogue('After')]);
        let finish!: () => void;
        context.flow.registerHandler({ autoNext: true, execute: () => new Promise<void>(resolve => { finish = resolve; }), type: 'wait' });
        context.flow.start();
        await settle();
        expect(() => context.flow.captureSaveContinuation()).toThrow('Wait for the current command');
        finish();
        await settle();
        const saved = context.flow.captureSaveContinuation();
        context.flow.stop();
        context.flow.restoreSaveContinuation(saved);
        context.flow.reset();
        context.flow.start();
        await settle();
        expect(context.seen).toEqual(['After']);
        expect(context.flow.isRestoringPresentation).toBe(false);
    });

    it('holds restored presentation and queues behind suspension and pause', async () => {
        const context = await createContext([dialogue('First'), dialogue('Second')]);
        context.flow.start();
        await settle();
        const saved = context.flow.captureSaveContinuation();
        context.flow.stop();
        context.flow.restoreSaveContinuation(saved);
        const release = context.flow.acquireSuspension();
        context.flow.start();
        await settle();
        expect(context.seen).toEqual(['First']);
        context.flow.pause();
        release();
        await settle();
        expect(context.seen).toEqual(['First']);
        context.flow.step();
        await settle();
        expect(context.seen).toEqual(['First', 'First']);
        expect(context.scenes.currentIndex).toBe(1);
        await context.flow.playNext();
        expect(context.seen).toEqual(['First', 'First', 'Second']);
    });

    it('rejects standalone presentation execution that is not the active checkpoint', async () => {
        const context = await createContext([dialogue('Root')]);
        context.flow.start();
        await settle();
        let finish!: () => void;
        context.flow.registerHandler({ autoNext: false, execute: () => new Promise<void>(resolve => { finish = resolve; }), type: 'dialogue' });
        const pending = context.flow.runCommand(dialogue('Standalone'));
        await settle();
        expect(() => context.flow.captureSaveContinuation()).toThrow('Wait for the current command');
        finish();
        await pending;
    });

    it('rejects save at command notification and preserves a command paused by its listener', async () => {
        const context = await createContext([dialogue('Old'), dialogue('Next')]);
        context.flow.start();
        await settle();
        const blocked: string[] = [];
        const onCommand = (_scene: string, index: number) => {
            if (index !== 1) return;
            try { context.flow.captureSaveContinuation(); } catch (error) { blocked.push(String(error)); }
            context.flow.pause();
        };
        context.events.on('flow:command', onCommand);
        await context.flow.playNext();
        expect(blocked[0]).toContain('Wait for the current command');
        expect(context.scenes.currentIndex).toBe(1);
        expect(context.seen).toEqual(['Old']);
        expect(context.flow.captureSaveContinuation().replay?.command.text).toBe('Old');
        context.events.off('flow:command', onCommand);
        context.flow.resume();
        await settle();
        expect(context.seen).toEqual(['Old', 'Next']);
    });

    it('preserves an effect selected before its command listener suspends playback', async () => {
        const context = await createContext([dialogue('Old'), increment, dialogue('Next')]);
        context.state.set('count', 0);
        context.flow.start();
        await settle();
        let release!: () => void;
        const onCommand = (_scene: string, index: number) => {
            if (index === 1) release = context.flow.acquireSuspension();
        };
        context.events.on('flow:command', onCommand);
        const advancing = context.flow.playNext();
        await settle();
        expect(context.scenes.currentIndex).toBe(1);
        expect(context.state.get('count')).toBe(0);
        expect(() => context.flow.captureSaveContinuation()).toThrow('Wait for the current command');
        context.events.off('flow:command', onCommand);
        release();
        await advancing;
        expect(context.state.get('count')).toBe(1);
        expect(context.seen).toEqual(['Old', 'Next']);
    });
});

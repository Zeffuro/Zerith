import { describe, expect, it, vi } from 'vitest';

import type { BaseCommand } from '../../types';

import { FlowManager } from '../FlowManager';

type EmitRecord = {
    arguments_: unknown[];
    event: string;
};

type TestContext = {
    emitted: EmitRecord[];
    execute: ReturnType<typeof vi.fn>;
    flow: FlowManager;
    scenes: {
        currentIndex: number;
        currentSceneName: string;
        script: BaseCommand[];
    };
};

describe('FlowManager', () => {
    it('start() executes script commands and stop() resets started state', async () => {
        const commandA = { duration: 0, type: 'wait' } as BaseCommand;
        const commandB = { duration: 0, type: 'wait' } as BaseCommand;
        const context = createFlowManagerTestContext([commandA, commandB]);

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
        const context = createFlowManagerTestContext([]);

        context.flow.start();
        await flushAsync();

        context.flow.pause();
        context.flow.resume();
        await flushAsync();

        expect(context.emitted.some((entry) => entry.event === 'flow:paused')).toBe(true);
        expect(context.emitted.some((entry) => entry.event === 'flow:resumed')).toBe(true);
    });

    it('step() runs one injected command then pauses again', async () => {
        const context = createFlowManagerTestContext([]);

        context.flow.start();
        await flushAsync();
        context.flow.pause();
        context.flow.injectCommands([{ duration: 0, type: 'wait' } as BaseCommand]);

        context.flow.step();
        await flushAsync();

        expect(context.execute).toHaveBeenCalledTimes(1);
        expect(context.emitted.some((entry) => entry.event === 'flow:stepped')).toBe(true);
        expect(context.emitted.filter((entry) => entry.event === 'flow:paused').length).toBeGreaterThan(0);
        expect(context.flow.isPaused).toBe(true);
    });
});

function createFlowManagerTestContext(script: BaseCommand[]): TestContext {
    const emitted: EmitRecord[] = [];
    const events = {
        destroy: vi.fn(),
        emit: vi.fn((event: string, ...arguments_: unknown[]) => {
            emitted.push({ arguments_, event });
        }),
        off: vi.fn(),
        on: vi.fn(),
        once: vi.fn(),
    };

    const scenes = {
        currentIndex: 0,
        currentSceneName: 'intro',
        script,
    };

    const execute = vi.fn(async () => {});
    const logger = {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    };

    const sceneManager = {
        addScene: vi.fn(),
        get currentIndex() {
            return scenes.currentIndex;
        },
        set currentIndex(value: number) {
            scenes.currentIndex = value;
        },
        get currentSceneName() {
            return scenes.currentSceneName;
        },
        destroy: vi.fn(),
        getCommandAt: (index: number) => scenes.script[index],
        getLastOriginalIndex: (runtimeIndex: number) => runtimeIndex,
        getOriginalIndex: (runtimeIndex: number) => runtimeIndex,
        getTemplate: vi.fn(),
        hasScene: vi.fn(),
        injectCommands: vi.fn(),
        jumpToScene: vi.fn(),
        loadScenes: vi.fn(),
        registerTemplate: vi.fn(),
        get script() {
            return scenes.script;
        },
        get scriptLength() {
            return scenes.script.length;
        },
    };

    const flow = new FlowManager({
        events: events as never,
        handlers: new Map([
            ['wait', { autoNext: true, execute, type: 'wait' }],
        ]),
        logger: logger as never,
        scenes: sceneManager as never,
    });

    return {
        emitted,
        execute,
        flow,
        scenes,
    };
}

async function flushAsync() {
    await Promise.resolve();
    await Promise.resolve();
}


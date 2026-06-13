import { vi } from 'vitest';

import type { BaseCommand } from '../types';

import { FlowManager } from '../managers/FlowManager';

export type EmitRecord = {
    arguments_: unknown[];
    event: string;
};

export type FlowManagerHarness = {
    emitted: EmitRecord[];
    execute: ReturnType<typeof vi.fn>;
    flow: FlowManager;
    scenes: {
        currentIndex: number;
        currentSceneName: string;
        script: BaseCommand[];
    };
};

export function createFlowManagerHarness(script: BaseCommand[]): FlowManagerHarness {
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
        scenes: sceneManager,
    });

    return {
        emitted,
        execute,
        flow,
        scenes,
    };
}

export async function flushAsync(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
}


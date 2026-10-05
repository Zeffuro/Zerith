import { vi } from 'vitest';

import type { EngineDeps } from '../Engine';
import type { RegisteredCommandHandler } from '../interfaces/ICommandHandler';
import type { MenuPanel, RuntimePlugin } from '../types';

import { Engine } from '../Engine';
import { EventBus } from '../managers/EventBus';
import { StateManager } from '../managers/StateManager';
import { createLoggerMock } from './audioHarness';
import { createFlowManagerHarness } from './flowManagerHarness';

export function deferred<T = void>() {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
    return { promise, reject, resolve };
}

export function pluginHandler(type = 'marker') {
    return { destroy: vi.fn<NonNullable<RegisteredCommandHandler['destroy']>>(), execute: vi.fn(), type };
}

export function pluginManifest(id: string): RuntimePlugin['manifest'] {
    return { capabilities: ['commands', 'overlays'], id, name: id, version: '1.0.0' };
}

export function pluginPanel(id = 'panel'): MenuPanel {
    return { build: vi.fn(), id, label: id };
}

export function runtimePluginHarness() {
    const { flow } = createFlowManagerHarness([]);
    const panels = new Map<string, MenuPanel>();
    const events = new EventBus();
    const state = new StateManager(events);
    const logger = createLoggerMock();
    const deps = {
        animations: { clear: vi.fn() }, assets: {}, audio: { stopAll: vi.fn() }, display: {}, events, flow,
        history: { clear: vi.fn() }, input: { detach: vi.fn() }, items: { clear: vi.fn() }, notifications: {},
        overlay: { hasPanel: (id: string) => panels.has(id), registerPanel: (panel: MenuPanel) => panels.set(panel.id, panel), removePanel: (id: string) => panels.delete(id) },
        saves: {}, scenes: {}, spritesheets: {}, startScreen: {}, state,
    } as unknown as EngineDeps;
    const engine = new Engine({}, deps);
    engine.logger = logger;
    return { engine, flow, logger, panels };
}

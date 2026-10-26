import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { EngineDeps } from '../Engine';

const mocks = vi.hoisted(() => ({ bind: vi.fn(), create: vi.fn(), handlers: vi.fn(), panels: vi.fn(() => []) }));
vi.mock('../bootstrap/createManagers', () => ({ createManagers: mocks.create }));
vi.mock('../bootstrap/registerHandlers', () => ({ registerHandlers: mocks.handlers }));
vi.mock('../bootstrap/createPanels', () => ({ createPanels: mocks.panels }));
vi.mock('../bootstrap/bindDefaultInputEvents', () => ({ bindDefaultInputEvents: mocks.bind }));

import { Engine } from '../Engine';
import { bootstrapEngine } from '../EngineBootstrap';

function deferred() {
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
    return { promise, reject, resolve };
}

function harness() {
    const names = ['animations', 'assets', 'audio', 'display', 'events', 'flow', 'history', 'input', 'items', 'notifications', 'overlay', 'saves', 'scenes', 'spritesheets', 'startScreen', 'state'] as const;
    const managers = Object.fromEntries(names.map(name => [name, { destroy: vi.fn() }])) as Record<typeof names[number], { destroy: ReturnType<typeof vi.fn> }>;
    const display = Object.assign(managers.display, { clearLayers: vi.fn(), init: vi.fn(async () => {}) });
    const audio = Object.assign(managers.audio, { init: vi.fn(async () => {}), stopAll: vi.fn() });
    const input = Object.assign(managers.input, { attach: vi.fn(), detach: vi.fn() });
    const assets = Object.assign(managers.assets, { preloadCharacterAssets: vi.fn(async () => {}), setResolver: vi.fn() });
    const flow = Object.assign(managers.flow, { destroyHandlers: vi.fn(), reset: vi.fn(), resetHandlers: vi.fn(), stop: vi.fn() });
    Object.assign(managers.animations, { clear: vi.fn() });
    Object.assign(managers.history, { clear: vi.fn() });
    Object.assign(managers.items, { clear: vi.fn() });
    Object.assign(managers.state, { clear: vi.fn(), loadPersistentState: vi.fn() });
    Object.assign(managers.spritesheets, { setResolver: vi.fn() });
    const saves = Object.assign(managers.saves, { loadGlobalState: vi.fn(() => ({})) });
    mocks.create.mockReturnValue({ deps: managers, flow, saveManager: saves, state: managers.state });
    return { assets, audio, display, flow, input, managers, saves };
}

const canvas = {} as HTMLCanvasElement;

describe('bootstrap initialization ownership', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.handlers.mockReturnValue({ dialogueHandler: {} });
        mocks.panels.mockReturnValue([]);
    });

    it('does not allocate managers for an already aborted request', async () => {
        const controller = new AbortController();
        controller.abort();
        await expect(bootstrapEngine({ canvas, signal: controller.signal })).rejects.toThrow();
        expect(mocks.create).not.toHaveBeenCalled();
    });

    it.each(['preload', 'display', 'audio'] as const)('retires the engine immediately during pending %s and never attaches input', async phase => {
        const h = harness();
        const pending = deferred();
        const operation = phase === 'preload' ? h.assets.preloadCharacterAssets : (phase === 'display' ? h.display.init : h.audio.init);
        operation.mockReturnValueOnce(pending.promise);
        const controller = new AbortController();
        const task = bootstrapEngine({ canvas, preloadAssets: phase === 'preload', signal: controller.signal });
        const rejected = expect(task).rejects.toThrow();
        await vi.waitFor(() => expect(operation).toHaveBeenCalledOnce());
        controller.abort();
        for (const [name, manager] of Object.entries(h.managers)) { if (name !== 'flow') expect(manager.destroy).toHaveBeenCalledOnce(); }
        pending.resolve();
        await rejected;
        expect(h.input.attach).not.toHaveBeenCalled();
        expect(mocks.bind).not.toHaveBeenCalled();
        if (phase !== 'audio') expect(h.audio.init).not.toHaveBeenCalled();
        if (phase === 'preload') expect(h.display.init).not.toHaveBeenCalled();
        for (const [name, manager] of Object.entries(h.managers)) { if (name !== 'flow') expect(manager.destroy).toHaveBeenCalledOnce(); }
    });

    it.each(['display', 'audio'] as const)('cleans every manager when pending %s fails after cancellation', async phase => {
        const h = harness();
        const pending = deferred();
        const operation = phase === 'display' ? h.display.init : h.audio.init;
        operation.mockReturnValueOnce(pending.promise);
        const controller = new AbortController();
        const task = bootstrapEngine({ canvas, signal: controller.signal });
        const rejected = expect(task).rejects.toThrow('initialization failed');
        await vi.waitFor(() => expect(operation).toHaveBeenCalledOnce());
        controller.abort();
        pending.reject(new Error('initialization failed'));
        await rejected;
        expect(h.input.attach).not.toHaveBeenCalled();
        for (const [name, manager] of Object.entries(h.managers)) { if (name !== 'flow') expect(manager.destroy).toHaveBeenCalledOnce(); }
    });

    it.each(['handlers', 'display', 'audio', 'persistent'] as const)('cleans owned managers when %s fails without cancellation', async phase => {
        const h = harness();
        const failure = new Error('bootstrap failure');
        if (phase === 'handlers') mocks.handlers.mockImplementation(() => { throw failure; });
        if (phase === 'display') h.display.init.mockRejectedValueOnce(failure);
        if (phase === 'audio') h.audio.init.mockRejectedValueOnce(failure);
        if (phase === 'persistent') h.saves.loadGlobalState.mockImplementation(() => { throw failure; });
        await expect(bootstrapEngine({ canvas })).rejects.toThrow('bootstrap failure');
        expect(h.input.detach).toHaveBeenCalledOnce();
        for (const [name, manager] of Object.entries(h.managers)) { if (name !== 'flow') expect(manager.destroy).toHaveBeenCalledOnce(); }
    });

    it('transfers a successful engine to its caller and removes the bootstrap abort listener', async () => {
        const h = harness();
        const controller = new AbortController();
        const engine = await bootstrapEngine({ canvas, signal: controller.signal });
        expect(h.input.attach).toHaveBeenCalledWith(canvas);
        expect(mocks.bind).toHaveBeenCalledWith(engine);
        controller.abort();
        expect(h.display.destroy).not.toHaveBeenCalled();
        engine.destroy();
        expect(h.display.destroy).toHaveBeenCalledOnce();
    });

    it('does not initialize an engine already destroyed by its caller', async () => {
        const h = harness();
        const engine = new Engine({}, h.managers as unknown as EngineDeps);
        engine.destroy();
        await expect(engine.init(canvas)).rejects.toThrow('destroyed');
        expect(h.display.init).not.toHaveBeenCalled();
    });

    it('continues teardown after a handler or layer destructor throws', async () => {
        const h = harness();
        h.display.clearLayers.mockImplementation(() => { throw new Error('layer failure'); });
        h.flow.destroyHandlers.mockImplementation(() => { throw new Error('handler failure'); });
        const engine = new Engine({}, h.managers as unknown as EngineDeps);
        const log = vi.spyOn(engine.logger, 'error').mockImplementation(() => {});
        engine.destroy();
        await vi.waitFor(() => expect(log).toHaveBeenCalledTimes(2));
        for (const [name, manager] of Object.entries(h.managers)) { if (name !== 'flow') expect(manager.destroy).toHaveBeenCalledOnce(); }
    });
});

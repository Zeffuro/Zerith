import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { subscribeToProjectFileWatcher } from '../projectFileWatcher';

function createDependencies() {
    const callbacks: ((event: { payload: { generation: number; path: string } }) => void)[] = [];
    const unlisten = vi.fn();
    return {
        callbacks,
        invoke: vi.fn<(command: string, arguments_: Record<string, unknown>) => Promise<unknown>>().mockImplementation(() => Promise.resolve()),
        listen: vi.fn<(event: string, callback: typeof callbacks[number]) => Promise<() => void>>((_event, callback) => {
            callbacks.push(callback);
            return Promise.resolve(unlisten);
        }),
        onError: vi.fn(),
        refresh: vi.fn<() => Promise<void>>().mockResolvedValue(),
        unlisten,
    };
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((callback) => { resolve = callback; });
    return { promise, resolve };
}

describe('project watcher ownership and delivery', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('listens before starting and does not postpone refresh under sustained events', async () => {
        const deps = createDependencies();
        const cleanup = subscribeToProjectFileWatcher('/A', 10, deps);
        await Promise.resolve();
        expect(deps.invoke).toHaveBeenCalledWith('start_project_file_watcher', { generation: 10, projectPath: '/A' });
        for (let index = 0; index < 10; index += 1) {
            deps.callbacks[0]?.({ payload: { generation: 10, path: '/A' } });
            await vi.advanceTimersByTimeAsync(50);
        }
        expect(deps.refresh).toHaveBeenCalledTimes(2);
        cleanup();
        expect(deps.unlisten).toHaveBeenCalledOnce();
    });

    it('ignores old-generation events and cleanup only cancels its own generation', async () => {
        const deps = createDependencies();
        const disposeA = subscribeToProjectFileWatcher('/A', 10, deps);
        const disposeB = subscribeToProjectFileWatcher('/B', 11, deps);
        await Promise.resolve();
        disposeA();
        deps.callbacks[1]?.({ payload: { generation: 10, path: '/A' } });
        await vi.advanceTimersByTimeAsync(200);
        expect(deps.refresh).not.toHaveBeenCalled();
        expect(deps.invoke).toHaveBeenCalledWith('stop_project_file_watcher', { generation: 10 });
        expect(deps.invoke).not.toHaveBeenCalledWith('stop_project_file_watcher', { generation: 11 });
        deps.callbacks[1]?.({ payload: { generation: 11, path: '/B' } });
        await vi.advanceTimersByTimeAsync(200);
        expect(deps.refresh).toHaveBeenCalledOnce();
        disposeB();
    });

    it('disposal before listener registration cannot start a stale watcher', async () => {
        const deps = createDependencies();
        const registration = deferred<() => void>();
        deps.listen.mockImplementation(() => registration.promise);
        const dispose = subscribeToProjectFileWatcher('/A', 10, deps);
        dispose();
        registration.resolve(deps.unlisten);
        await Promise.resolve();
        expect(deps.unlisten).toHaveBeenCalledOnce();
        expect(deps.invoke).not.toHaveBeenCalledWith('start_project_file_watcher', expect.anything());
        expect(deps.invoke).toHaveBeenCalledWith('stop_project_file_watcher', { generation: 10 });
    });

    it('cancels pending startup without waiting for it to finish', async () => {
        const deps = createDependencies();
        const startup = deferred<void>();
        deps.invoke.mockImplementation((command) => command === 'start_project_file_watcher' ? startup.promise : Promise.resolve());
        const dispose = subscribeToProjectFileWatcher('/A', 10, deps);
        await Promise.resolve();
        dispose();
        expect(deps.invoke).toHaveBeenCalledWith('stop_project_file_watcher', { generation: 10 });
        startup.resolve();
        await vi.advanceTimersByTimeAsync(400);
        expect(deps.refresh).not.toHaveBeenCalled();
    });

    it('serializes slow refreshes and follows up for changes received in flight', async () => {
        const deps = createDependencies();
        const pending = deferred<void>();
        deps.refresh.mockReturnValueOnce(pending.promise);
        const dispose = subscribeToProjectFileWatcher('/A', 10, deps);
        await Promise.resolve();
        deps.callbacks[0]?.({ payload: { generation: 10, path: '/A' } });
        await vi.advanceTimersByTimeAsync(200);
        deps.callbacks[0]?.({ payload: { generation: 10, path: '/A' } });
        await vi.advanceTimersByTimeAsync(500);
        expect(deps.refresh).toHaveBeenCalledOnce();
        pending.resolve();
        await vi.advanceTimersByTimeAsync(200);
        expect(deps.refresh).toHaveBeenCalledTimes(2);
        dispose();
    });
});

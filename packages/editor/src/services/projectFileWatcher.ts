type WatcherDependencies = {
    invoke: (command: string, arguments_: Record<string, unknown>) => Promise<unknown>;
    listen: (event: string, callback: (event: { payload: WatcherPayload }) => void) => Promise<() => void>;
    onError: (error: unknown) => void;
    refresh: () => Promise<void>;
};
type WatcherPayload = { generation: number; path: string };

let nextGeneration = Date.now() * 1000;

export function allocateProjectWatcherGeneration(): number {
    try {
        const previous = Number(globalThis.sessionStorage.getItem('zerith.projectWatcherGeneration'));
        if (Number.isSafeInteger(previous)) nextGeneration = Math.max(nextGeneration, previous);
        nextGeneration += 1;
        globalThis.sessionStorage.setItem('zerith.projectWatcherGeneration', String(nextGeneration));
    } catch {
        nextGeneration += 1;
    }
    return nextGeneration;
}

export function subscribeToProjectFileWatcher(
    projectPath: string,
    generation: number,
    dependencies: WatcherDependencies,
): () => void {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    let timeout: ReturnType<typeof globalThis.setTimeout> | undefined;
    let refreshing = false;
    let refreshRequested = false;

    const scheduleRefresh = () => {
        if (disposed || refreshing || timeout !== undefined || !refreshRequested) return;
        timeout = globalThis.setTimeout(() => {
            timeout = undefined;
            refreshRequested = false;
            if (disposed) return;
            refreshing = true;
            void dependencies.refresh().catch((error: unknown) => {
                if (!disposed) dependencies.onError(error);
            }).finally(() => {
                refreshing = false;
                scheduleRefresh();
            });
        }, 200);
    };

    const stop = () => {
        void dependencies.invoke('stop_project_file_watcher', { generation }).catch(dependencies.onError);
    };

    void dependencies.listen('project:file-changed', (event) => {
        if (disposed || event.payload?.generation !== generation) return;
        refreshRequested = true;
        scheduleRefresh();
    }).then(async (cleanup) => {
        if (disposed) {
            cleanup();
            return;
        }
        unlisten = cleanup;
        await dependencies.invoke('start_project_file_watcher', { generation, projectPath });
    }).catch((error: unknown) => {
        const wasDisposed = disposed;
        disposed = true;
        if (timeout !== undefined) globalThis.clearTimeout(timeout);
        unlisten?.();
        unlisten = undefined;
        stop();
        if (!wasDisposed) dependencies.onError(error);
    });

    return () => {
        disposed = true;
        if (timeout !== undefined) globalThis.clearTimeout(timeout);
        unlisten?.();
        unlisten = undefined;
        stop();
    };
}

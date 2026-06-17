import { useEffect } from 'react';

import { isTauriRuntime } from '../services/runtime/runtimeEnvironment';
import { executeExternalProjectTreeRefreshAction } from '../store/actions/projectTreeActions';
import { useProjectStore } from '../store/storeBootstrap';

type ProjectFileWatcherEventPayload = {
    path: string;
};

const FILE_WATCHER_EVENTS = [
    'project:file-added',
    'project:file-removed',
    'project:file-changed',
] as const;

const WATCHER_DEBOUNCE_MS = 200;
const NOOP_CLEANUP = () => {};

export function useProjectFileWatcher() {
    const projectPath = useProjectStore((state) => state.projectPath);

    useEffect(() => {
        if (!projectPath || !isTauriRuntime()) return;

        let isDisposed = false;
        let refreshTimeout: ReturnType<typeof globalThis.setTimeout> | undefined;

        const refreshTree = () => {
            if (refreshTimeout !== undefined) {
                globalThis.clearTimeout(refreshTimeout);
            }

            refreshTimeout = globalThis.setTimeout(() => {
                if (isDisposed) return;
                void executeExternalProjectTreeRefreshAction(projectPath);
            }, WATCHER_DEBOUNCE_MS);
        };

        const subscribe = async () => {
            const [{ invoke }, { listen }] = await Promise.all([
                import('@tauri-apps/api/core'),
                import('@tauri-apps/api/event'),
            ]);

            await invoke('start_project_file_watcher', { projectPath });

            const unlisteners = await Promise.all(
                FILE_WATCHER_EVENTS.map((eventName) =>
                    listen<ProjectFileWatcherEventPayload>(eventName, (event) => {
                        if (!event.payload?.path) return;
                        refreshTree();
                    }),
                ),
            );

            return () => {
                for (const unlisten of unlisteners) {
                    unlisten();
                }
                void invoke('stop_project_file_watcher');
            };
        };

        const cleanupPromise = subscribe()
            .then((cleanup) => cleanup)
            .catch((error) => {
                console.error('Failed to initialize project file watcher:', error);
                return NOOP_CLEANUP;
            });

        return () => {
            isDisposed = true;

            if (refreshTimeout !== undefined) {
                globalThis.clearTimeout(refreshTimeout);
            }

            void cleanupPromise.then((cleanup) => cleanup());
        };
    }, [projectPath]);
}


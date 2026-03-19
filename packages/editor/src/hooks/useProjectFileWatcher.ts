import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';

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
        if (!projectPath || !hasTauriInternals()) return;

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
            void invoke('stop_project_file_watcher');
        };
    }, [projectPath]);
}

function hasTauriInternals(): boolean {
    const windowObject = globalThis.window as { __TAURI_INTERNALS__?: unknown } | undefined;
    return windowObject?.__TAURI_INTERNALS__ !== undefined;
}


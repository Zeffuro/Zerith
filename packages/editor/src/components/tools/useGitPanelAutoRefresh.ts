import { useEffect, type RefObject } from 'react';

import { isTauriRuntime } from '../../services/runtime/runtimeEnvironment';

type ProjectFileWatcherEventPayload = {
    path: string;
};

const FILE_WATCHER_EVENTS = [
    'project:file-added',
    'project:file-removed',
    'project:file-changed',
] as const;

const GIT_REFRESH_DEBOUNCE_MS = 250;

export function useGitPanelAutoRefresh({
    busyActionRef,
    projectPath,
    refreshReports,
}: {
    busyActionRef: RefObject<unknown>;
    projectPath: string | undefined;
    refreshReports: (options?: { silent?: boolean }) => Promise<void>;
}) {
    useEffect(() => {
        if (!projectPath || !isTauriRuntime()) return;

        let isDisposed = false;
        let refreshTimeout: ReturnType<typeof globalThis.setTimeout> | undefined;
        let cleanup: (() => void) | undefined;

        const scheduleRefresh = () => {
            if (refreshTimeout !== undefined) {
                globalThis.clearTimeout(refreshTimeout);
            }

            refreshTimeout = globalThis.setTimeout(() => {
                if (isDisposed || busyActionRef.current) return;
                void refreshReports({ silent: true });
            }, GIT_REFRESH_DEBOUNCE_MS);
        };

        const subscribe = async () => {
            const { listen } = await import('@tauri-apps/api/event');
            const unlisteners = await Promise.all(
                FILE_WATCHER_EVENTS.map((eventName) =>
                    listen<ProjectFileWatcherEventPayload>(eventName, (event) => {
                        if (!event.payload?.path) return;
                        scheduleRefresh();
                    }),
                ),
            );

            if (isDisposed) {
                for (const unlisten of unlisteners) {
                    unlisten();
                }
                return;
            }

            cleanup = () => {
                for (const unlisten of unlisteners) {
                    unlisten();
                }
            };
        };

        void subscribe().catch((error) => {
            console.error('Failed to subscribe Git panel to project file watcher:', error);
        });

        return () => {
            isDisposed = true;
            if (refreshTimeout !== undefined) {
                globalThis.clearTimeout(refreshTimeout);
            }
            cleanup?.();
        };
    }, [busyActionRef, projectPath, refreshReports]);
}

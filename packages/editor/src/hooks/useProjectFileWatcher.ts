import { useEffect } from 'react';

import { allocateProjectWatcherGeneration, subscribeToProjectFileWatcher } from '../services/projectFileWatcher';
import { isTauriRuntime } from '../services/runtime/runtimeEnvironment';
import { executeExternalProjectTreeRefreshAction } from '../store/actions/projectTreeActions';
import { useProjectStore } from '../store/storeBootstrap';

export function useProjectFileWatcher() {
    const projectPath = useProjectStore((state) => state.projectPath);
    const projectGeneration = useProjectStore((state) => state.projectGeneration);

    useEffect(() => {
        if (!projectPath || !isTauriRuntime()) return;

        let isDisposed = false;
        let cleanup: (() => void) | undefined;
        const generation = allocateProjectWatcherGeneration();

        const subscribe = async () => {
            const [{ invoke }, { listen }] = await Promise.all([
                import('@tauri-apps/api/core'),
                import('@tauri-apps/api/event'),
            ]);

            if (isDisposed) return;
            cleanup = subscribeToProjectFileWatcher(projectPath, generation, {
                invoke,
                listen,
                onError: (error) => { console.error('Project file watcher failed:', error); },
                refresh: () => executeExternalProjectTreeRefreshAction(projectPath),
            });
        };

        void subscribe().catch((error: unknown) => {
            console.error('Failed to initialize project file watcher:', error);
        });

        return () => {
            isDisposed = true;

            cleanup?.();
        };
    }, [projectPath, projectGeneration]);
}


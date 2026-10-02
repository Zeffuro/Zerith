import { useEffect, useSyncExternalStore } from 'react';

import { browserFsAdapter } from '../services/fs/browserFsAdapter';
import { isTauriRuntime } from '../services/runtime/runtimeEnvironment';
import { beginProjectOpenRequest, executeOpenProjectInCurrentWindow, type ProjectOpenResult } from '../store/actions/projectOpenActions';
import { useEditorStore } from '../store/useEditorStore';
import { useSettingsStore } from '../store/useSettingsStore';

const registry = browserFsAdapter.recentProjects;

export async function openRecentProject(manifestPath: string): Promise<ProjectOpenResult> {
    if (isTauriRuntime()) return executeOpenProjectInCurrentWindow(manifestPath);
    const request = beginProjectOpenRequest();
    try {
        if (!await registry.restore(manifestPath)) return { status: 'cancelled' };
        if (!request.isCurrent()) return { status: 'cancelled' };
        return await executeOpenProjectInCurrentWindow(manifestPath, { request });
    } catch (error) {
        if (!request.isCurrent()) return { status: 'cancelled' };
        useEditorStore.getState().announceOperationStatus(
            `Could not reopen project: ${error instanceof Error ? error.message : String(error)}. Open its folder to try again.`,
            'error',
        );
        return { status: 'cancelled' };
    }
}

export function useRecentProjects() {
    const desktop = isTauriRuntime();
    const stored = useSettingsStore(state => state.recentProjects);
    const browser = useSyncExternalStore(registry.subscribe, registry.getSnapshot);
    useEffect(() => {
        if (!desktop && browserFsAdapter.isSupported()) {
            void registry.ready().catch(() => {
                useEditorStore.getState().announceOperationStatus('Recent browser projects could not be loaded. You can still open a folder.', 'error');
            });
        }
    }, [desktop]);

    return {
        addRecentProject: desktop ? useEditorStore.getState().addRecentProject : () => {},
        clearRecentProjects: () => {
            if (desktop) useEditorStore.getState().clearRecentProjects();
            else void registry.clear().catch(() => {
                useEditorStore.getState().announceOperationStatus('Recent browser projects could not be cleared.', 'error');
            });
        },
        openRecentProject,
        recentProjects: desktop ? stored : browser,
        supportsRecentProjects: desktop || browserFsAdapter.isSupported(),
    };
}

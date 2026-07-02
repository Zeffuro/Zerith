import { useEffect, useRef } from 'react';

import { confirmEditorAction } from '../services/editorDialogs';
import { runStartupEditorUpdateCheck } from '../services/editorStartupUpdateCheck';
import {
    createEditorUpdateInstallPrompt,
    runEditorUpdateCheck,
} from '../services/editorUpdateClient';
import { isTauriRuntime } from '../services/runtime/runtimeEnvironment';
import { useEditorStore } from '../store/useEditorStore';
import { useSettingsStore } from '../store/useSettingsStore';

const STARTUP_UPDATE_CHECK_DELAY_MS = 1000;

export function useStartupEditorUpdateCheck(): void {
    const announceOperationStatus = useEditorStore((state) => state.announceOperationStatus);
    const hasRun = useRef(false);

    useEffect(() => {
        const timer = globalThis.setTimeout(() => {
            if (hasRun.current) return;
            hasRun.current = true;

            const { checkForUpdatesOnStartup } = useSettingsStore.getState();

            void runStartupEditorUpdateCheck({
                announceOperationStatus,
                checkForUpdatesOnStartup,
                confirmInstall: async (update) => confirmEditorAction({
                    cancelText: 'Later',
                    confirmText: 'Install',
                    message: await createEditorUpdateInstallPrompt(update),
                    title: 'Install Editor Update',
                }),
                isDesktopRuntime: isTauriRuntime,
                runUpdateCheck: runEditorUpdateCheck,
            });
        }, STARTUP_UPDATE_CHECK_DELAY_MS);

        return () => globalThis.clearTimeout(timer);
    }, [announceOperationStatus]);
}

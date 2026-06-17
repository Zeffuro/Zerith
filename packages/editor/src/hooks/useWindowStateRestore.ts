import { useEffect } from 'react';

import { isTauriRuntime } from '../services/runtime/runtimeEnvironment';
import { useSettingsStore } from '../store/useSettingsStore';

export function useWindowStateRestore() {
    useEffect(() => {
        if (!isTauriRuntime()) return;

        let disposed = false;
        let onEvent: (() => void) | undefined;
        let unlistenMove: Promise<() => void> | undefined;
        let unlistenResize: Promise<() => void> | undefined;

        void (async () => {
            const [{ PhysicalPosition, PhysicalSize }, { getCurrentWindow }] = await Promise.all([
                import('@tauri-apps/api/dpi'),
                import('@tauri-apps/api/window'),
            ]);

            if (disposed) return;

            const appWindow = getCurrentWindow();
            const { setWindowState, windowState } = useSettingsStore.getState();
            const restoredWindowState = sanitizeRestoredWindowState(windowState);

            if (windowState && !restoredWindowState) {
                setWindowState(undefined);
            }

            if (restoredWindowState) {
                void appWindow.setSize(new PhysicalSize(restoredWindowState.width, restoredWindowState.height));
                void appWindow.setPosition(new PhysicalPosition(restoredWindowState.x, restoredWindowState.y));
                if (restoredWindowState.maximized) void appWindow.maximize();
            }

            const saveState = async () => {
                const size = await appWindow.innerSize();
                const pos = await appWindow.outerPosition();
                const max = await appWindow.isMaximized();

                setWindowState({ height: size.height, maximized: max, width: size.width, x: pos.x, y: pos.y });
            };

            onEvent = () => { void saveState(); };

            unlistenMove = appWindow.listen('tauri://move', onEvent);
            unlistenResize = appWindow.listen('tauri://resize', onEvent);
            window.addEventListener('beforeunload', onEvent);
        })();

        return () => {
            disposed = true;
            void unlistenMove?.then((f) => f());
            void unlistenResize?.then((f) => f());
            if (onEvent) {
                window.removeEventListener('beforeunload', onEvent);
            }
        };
    }, []);
}

function sanitizeRestoredWindowState(value: ReturnType<typeof useSettingsStore.getState>['windowState']) {
    if (!value) return;

    const isFinitePosition = Number.isFinite(value.x) && Number.isFinite(value.y);
    const isFiniteSize = Number.isFinite(value.width) && Number.isFinite(value.height);
    const hasMinimumSize = value.width >= 420 && value.height >= 320;
    if (!isFinitePosition || !isFiniteSize || !hasMinimumSize) return;

    return value;
}


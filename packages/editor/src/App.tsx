import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { type CSSProperties, useEffect } from 'react';

import { DockLayoutHost } from './components/layout/DockLayoutHost';
import { useGlobalEditorShortcuts } from './hooks/useGlobalEditorShortcuts';
import './App.css';
import { useLiveScriptValidation } from './hooks/useLiveScriptValidation';
import { setupConsoleInterceptor } from './services/consoleInterceptor';
import { useEditorStore } from './store/useEditorStore';
import { useScriptStore } from './store/useScriptStore';
import { applyTheme } from './theme/applyTheme';
import { getThemeRegistry } from './theme/themeRegistry';

function App() {
    const { themeKey, uiScale } = useEditorStore();
    const rootScript = useScriptStore((state) => state.rootScript);

    useGlobalEditorShortcuts();
    useLiveScriptValidation(rootScript);

    useEffect(() => {
        return setupConsoleInterceptor();
    }, []);

    useEffect(() => {
        if (!hasTauriInternals()) return;

        const appWindow = getCurrentWindow();
        const { setWindowState, windowState } = useEditorStore.getState();
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
        
        const onEvent = () => { void saveState(); };

        const unlistenMove = appWindow.listen('tauri://move', onEvent);
        const unlistenResize = appWindow.listen('tauri://resize', onEvent);
        window.addEventListener('beforeunload', onEvent);

        return () => {
            void unlistenMove.then((f) => f());
            void unlistenResize.then((f) => f());
            window.removeEventListener('beforeunload', onEvent);
        };
    }, []);

    useEffect(() => {
        const themes = getThemeRegistry();
        const selected = themes.find((t) => t.key === themeKey) ?? themes.find((t) => t.key === 'classic') ?? themes[0];
        if (selected) applyTheme(selected);
    }, [themeKey]);

    return (
        <div style={{ '--ui-scale': uiScale, inset: 0, overflow: 'hidden', position: 'fixed' } as CSSProperties}>
            <DockLayoutHost />
        </div>
    );
}

export default App;

function hasTauriInternals(): boolean {
    const windowObject = globalThis.window as { __TAURI_INTERNALS__?: unknown } | undefined;
    return windowObject?.__TAURI_INTERNALS__ !== undefined;
}

function sanitizeRestoredWindowState(value: ReturnType<typeof useEditorStore.getState>['windowState']) {
    if (!value) return;

    const isFinitePosition = Number.isFinite(value.x) && Number.isFinite(value.y);
    const isFiniteSize = Number.isFinite(value.width) && Number.isFinite(value.height);
    const hasMinimumSize = value.width >= 420 && value.height >= 320;
    if (!isFinitePosition || !isFiniteSize || !hasMinimumSize) return;

    return value;
}


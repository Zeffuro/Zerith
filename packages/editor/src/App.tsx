import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect } from 'react';

import { DockLayoutHost } from './components/layout/DockLayoutHost';
import { useGlobalEditorShortcuts } from './hooks/useGlobalEditorShortcuts';
import './App.css';
import { useLiveScriptValidation } from './hooks/useLiveScriptValidation';
import { useConsoleStore } from './store/useConsoleStore';
import { useEditorStore } from './store/useEditorStore';
import { useScriptStore } from './store/useScriptStore';
import { applyTheme } from './theme/applyTheme';
import { getThemeRegistry } from './theme/themeRegistry';

function App() {
    const { setWindowState, themeKey, uiScale, windowState } = useEditorStore();
    const rootScript = useScriptStore((state) => state.rootScript);

    useGlobalEditorShortcuts();
    useLiveScriptValidation(rootScript);

    useEffect(() => {
        const store = useConsoleStore.getState();
        const origLog = console.log;
        const origInfo = console.info;
        const origWarn = console.warn;
        const origError = console.error;

        console.log = (...arguments_) => { origLog(...arguments_); store.addMessage('editor', 'log', ...arguments_); };
        console.info = (...arguments_) => { origInfo(...arguments_); store.addMessage('editor', 'info', ...arguments_); };
        console.warn = (...arguments_) => { origWarn(...arguments_); store.addMessage('editor', 'warn', ...arguments_); };
        console.error = (...arguments_) => { origError(...arguments_); store.addMessage('editor', 'error', ...arguments_); };

        return () => {
            console.log = origLog;
            console.info = origInfo;
            console.warn = origWarn;
            console.error = origError;
        };
    },[]);

    useEffect(() => {
        const appWindow = getCurrentWindow();

        if (windowState) {
            appWindow.setSize(new PhysicalSize(windowState.width, windowState.height));
            appWindow.setPosition(new PhysicalPosition(windowState.x, windowState.y));
            if (windowState.maximized) appWindow.maximize();
        }

        const saveState = async () => {
            const size = await appWindow.innerSize();
            const pos = await appWindow.outerPosition();
            const max = await appWindow.isMaximized();

            setWindowState({ height: size.height, maximized: max, width: size.width, x: pos.x, y: pos.y });
        };

        const unlistenMove = appWindow.listen('tauri://move', saveState);
        const unlistenResize = appWindow.listen('tauri://resize', saveState);
        window.addEventListener('beforeunload', saveState);

        return () => {
            unlistenMove.then((f) => f());
            unlistenResize.then((f) => f());
            window.removeEventListener('beforeunload', saveState);
        };
    },[]);

    useEffect(() => {
        const themes = getThemeRegistry();
        const selected = themes.find((t) => t.key === themeKey) ?? themes.find((t) => t.key === 'classic') ?? themes[0];
        if (selected) applyTheme(selected);
    }, [themeKey]);

    return (
        <div style={{ ['--ui-scale' as any]: uiScale, inset: 0, overflow: 'hidden', position: 'fixed' }}>
            <DockLayoutHost />
        </div>
    );
}

export default App;
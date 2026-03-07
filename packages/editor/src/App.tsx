import { useEffect } from 'react';
import { DockLayoutHost } from './components/layout/DockLayoutHost';

import { useEditorStore } from './store/useEditorStore';
import { useScriptStore } from './store/useScriptStore';
import { useConsoleStore } from './store/useConsoleStore';

import './App.css';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { PhysicalSize, PhysicalPosition } from '@tauri-apps/api/dpi';
import { getThemeRegistry } from './theme/themeRegistry';
import { applyTheme } from './theme/applyTheme';
import { useGlobalEditorShortcuts } from './hooks/useGlobalEditorShortcuts';
import { useLiveScriptValidation } from './hooks/useLiveScriptValidation';

function App() {
    const { uiScale, windowState, setWindowState, themeKey } = useEditorStore();
    const rootScript = useScriptStore((state) => state.rootScript);

    useGlobalEditorShortcuts();
    useLiveScriptValidation(rootScript);

    useEffect(() => {
        const store = useConsoleStore.getState();
        const origLog = console.log;
        const origInfo = console.info;
        const origWarn = console.warn;
        const origError = console.error;

        console.log = (...args) => { origLog(...args); store.addMessage('editor', 'log', ...args); };
        console.info = (...args) => { origInfo(...args); store.addMessage('editor', 'info', ...args); };
        console.warn = (...args) => { origWarn(...args); store.addMessage('editor', 'warn', ...args); };
        console.error = (...args) => { origError(...args); store.addMessage('editor', 'error', ...args); };

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

            setWindowState({ width: size.width, height: size.height, x: pos.x, y: pos.y, maximized: max });
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
        <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', ['--ui-scale' as any]: uiScale }}>
            <DockLayoutHost />
        </div>
    );
}

export default App;
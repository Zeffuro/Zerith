import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { type CSSProperties, useEffect } from 'react';

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

        console.log = (...arguments_: any[]) => { origLog(...arguments_); store.addMessage('editor', 'log', ...arguments_); };
        console.info = (...arguments_: any[]) => { origInfo(...arguments_); store.addMessage('editor', 'info', ...arguments_); };
        console.warn = (...arguments_: any[]) => { origWarn(...arguments_); store.addMessage('editor', 'warn', ...arguments_); };
        console.error = (...arguments_: any[]) => { origError(...arguments_); store.addMessage('editor', 'error', ...arguments_); };

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
            void appWindow.setSize(new PhysicalSize(windowState.width, windowState.height));
            void appWindow.setPosition(new PhysicalPosition(windowState.x, windowState.y));
            if (windowState.maximized) void appWindow.maximize();
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
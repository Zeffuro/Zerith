import { useEffect } from 'react';
import { Settings2 } from 'lucide-react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { GamePreview } from './components/GamePreview';
import { Toolbar } from './components/layout/Toolbar';
import { Explorer } from './components/layout/Explorer';
import { Timeline } from './components/layout/Timeline';
import { Inspector } from './components/inspector/Inspector';

import { useEditorStore } from './store/useEditorStore';
import { useScriptStore } from './store/useScriptStore';

import './App.css';
import { getCurrentWindow } from "@tauri-apps/api/window";
import { PhysicalSize, PhysicalPosition } from "@tauri-apps/api/dpi";
import { getThemeRegistry } from './theme/themeRegistry';
import { applyTheme } from './theme/applyTheme';

function App() {

    const { uiScale, windowState, setWindowState, themeKey } = useEditorStore();
    const rootScript = useScriptStore(state => state.rootScript);

    // Window Persistence
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

            setWindowState({
                width: size.width,
                height: size.height,
                x: pos.x,
                y: pos.y,
                maximized: max
            });
        };

        const unlistenMove = appWindow.listen('tauri://move', saveState);
        const unlistenResize = appWindow.listen('tauri://resize', saveState);

        window.addEventListener('beforeunload', saveState);

        return () => {
            unlistenMove.then(f => f());
            unlistenResize.then(f => f());
            window.removeEventListener('beforeunload', saveState);
        };
    }, []);

    useEffect(() => {
        const handleDragOver = (e: DragEvent) => {
            e.preventDefault();
        };

        const handleDrop = (e: DragEvent) => {
            e.preventDefault();
        };

        window.addEventListener('dragover', handleDragOver);
        window.addEventListener('drop', handleDrop);

        return () => {
            window.removeEventListener('dragover', handleDragOver);
            window.removeEventListener('drop', handleDrop);
        };
    }, []);

    useEffect(() => {
        const themes = getThemeRegistry();
        const selected = themes.find(t => t.key === themeKey) ?? themes.find(t => t.key === 'classic') ?? themes[0];
        if (selected) applyTheme(selected);
    }, [themeKey]);

    return (
        <div style={{
            height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
            backgroundColor: '#1e1e1e', color: '#ccc', fontFamily: 'sans-serif',
            fontSize: `${13 * uiScale}px`
        }}>
            <Toolbar />

            <Group orientation="horizontal" style={{ flexGrow: 1 }}>
                <Panel defaultSize={20} minSize={15}>
                    <Explorer />
                </Panel>

                <ResizeHandle />

                <Panel defaultSize={40} minSize={20}>
                    <Timeline />
                </Panel>

                <ResizeHandle />

                <Panel defaultSize={40} minSize={25}>
                    <Group orientation="vertical">
                        <Panel defaultSize={60}>
                            <div style={{ height: '100%', backgroundColor: '#000' }}>
                                <GamePreview script={rootScript} />
                            </div>
                        </Panel>

                        <ResizeHandle horizontal />

                        <Panel defaultSize={40}>
                            <div style={{ padding: `${12 * uiScale}px`, height: '100%', backgroundColor: '#252526' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', marginBottom: `${16 * uiScale}px`, fontSize: '0.9em', fontWeight: 'bold' }}>
                                    <Settings2 size={16 * uiScale} /> INSPECTOR
                                </div>
                                <Inspector />
                            </div>
                        </Panel>
                    </Group>
                </Panel>
            </Group>
        </div>
    );
}

function ResizeHandle({ horizontal = false }: { horizontal?: boolean }) {
    return (
        <Separator
            style={{
                width: horizontal ? '100%' : '4px',
                height: horizontal ? '4px' : '100%',
                backgroundColor: '#333',
                cursor: horizontal ? 'row-resize' : 'col-resize',
                transition: 'background-color 0.2s',
            }}
        />
    );
}

export default App;
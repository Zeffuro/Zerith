import { useEffect, useState } from 'react';
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
import { useGlobalEditorShortcuts } from './hooks/useGlobalEditorShortcuts';
import { useLiveScriptValidation } from './hooks/useLiveScriptValidation';
import { AssetPreviewPanel } from './components/tools/AssetPreviewPanel';
import { ScriptJsonEditor } from "./components/layout/ScriptJsonEditor.tsx";

function App() {
    const { uiScale, windowState, setWindowState, themeKey } = useEditorStore();
    const rootScript = useScriptStore(state => state.rootScript);
    const [toolTab, setToolTab] = useState<'inspector' | 'json' | 'assets'>('inspector');

    const centerView = useEditorStore((s) => s.centerView);

    const toolTabBtn = (active: boolean) => ({
        border: `1px solid ${active ? 'var(--editor-border-accent)' : 'var(--editor-border-button)'}`,
        background: active ? 'var(--editor-bg-selected)' : 'transparent',
        color: active ? 'var(--editor-text-primary)' : 'var(--editor-text-normal)',
        borderRadius: 'var(--editor-radius-sm)',
        padding: `${3 * uiScale}px ${8 * uiScale}px`,
        cursor: 'pointer',
        fontSize: `${11 * uiScale}px`,
        lineHeight: 1.2,
    });

    useGlobalEditorShortcuts();
    useLiveScriptValidation(rootScript);

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
        const handleDragOver = (e: DragEvent) => e.preventDefault();
        const handleDrop = (e: DragEvent) => e.preventDefault();

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
                <Panel defaultSize={20} minSize={15}><Explorer /></Panel>
                <ResizeHandle />
                <Panel defaultSize={40} minSize={20}>
                    {centerView === 'timeline' ? <Timeline /> : <ScriptJsonEditor uiScale={uiScale} />}
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
                            <div style={{ padding: `${12 * uiScale}px`, height: '100%', backgroundColor: '#252526', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', marginBottom: `${12 * uiScale}px`, fontSize: '0.9em', fontWeight: 'bold' }}>
                                    <Settings2 size={16 * uiScale} />
                                    TOOLS
                                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                                        <button style={toolTabBtn(toolTab === 'inspector')} onClick={() => setToolTab('inspector')}>
                                            Inspector
                                        </button>
                                        <button style={toolTabBtn(toolTab === 'assets')} onClick={() => setToolTab('assets')}>
                                            Assets
                                        </button>
                                    </div>
                                </div>

                                <div style={{ flex: 1, minHeight: 0 }}>
                                    {toolTab === 'inspector' && <Inspector />}
                                    {toolTab === 'assets' && <AssetPreviewPanel uiScale={uiScale} />}
                                </div>
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
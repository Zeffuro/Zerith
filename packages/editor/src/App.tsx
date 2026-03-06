import { Panel, Group, Separator } from 'react-resizable-panels';
import { Settings2 } from 'lucide-react';
import { GamePreview } from './components/GamePreview';
import { Toolbar } from './components/layout/Toolbar';
import { Explorer } from './components/layout/Explorer';
import { Timeline } from './components/layout/Timeline';
import { Inspector } from './components/layout/Inspector';
import { useProjectStore } from './store/useProjectStore';
import './App.css';

function App() {
    const script = useProjectStore(state => state.script);

    return (
        <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', backgroundColor: '#1e1e1e', color: '#ccc', fontFamily: 'sans-serif' }}>
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
                                <GamePreview script={script} />
                            </div>
                        </Panel>

                        <ResizeHandle horizontal />

                        <Panel defaultSize={40}>
                            <div style={{ padding: '12px', height: '100%', backgroundColor: '#252526' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', marginBottom: '16px', fontSize: '12px', fontWeight: 'bold' }}>
                                    <Settings2 size={16} /> INSPECTOR
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
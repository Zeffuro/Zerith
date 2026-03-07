import { useEffect, useRef } from 'react';
import { Layout, Model, TabNode } from 'flexlayout-react';
import 'flexlayout-react/style/dark.css';

import { useEditorStore } from '../../store/useEditorStore';
import { useScriptStore } from '../../store/useScriptStore';
import { DOCK_PANELS } from '../../layout/dockPanelIds';

import { Explorer } from './Explorer';
import { Timeline } from './Timeline';
import { ScriptJsonEditor } from './ScriptJsonEditor';
import { Inspector } from '../inspector/Inspector';
import { AssetPreviewPanel } from '../tools/AssetPreviewPanel';
import { GamePreview } from '../GamePreview';
import { TopChrome } from './TopChrome';
import { ConsolePanel } from '../tools/ConsolePanel';

export function DockLayoutHost() {
    const uiScale = useEditorStore((s) => s.uiScale);
    const dockLayoutJson = useEditorStore((s) => s.dockLayoutJson);
    const setDockLayoutJson = useEditorStore((s) => s.setDockLayoutJson);
    const rootScript = useScriptStore((s) => s.rootScript);

    const modelRef = useRef<Model | null>(null);
    if (!modelRef.current) modelRef.current = Model.fromJson(dockLayoutJson);
    const model = modelRef.current;

    const saveTimerRef = useRef<number | null>(null);

    const onModelChange = (m: Model) => {
        if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = window.setTimeout(() => {
            setDockLayoutJson(m.toJson());
            saveTimerRef.current = null;
        }, 180);
    };

    useEffect(() => {
        return () => {
            if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
        };
    }, []);

    const factory = (node: TabNode) => {
        const comp = node.getComponent() as string;

        switch (comp) {
            case DOCK_PANELS.explorer:
                return <Explorer />;
            case DOCK_PANELS.timeline:
                return <Timeline />;
            case DOCK_PANELS.json:
                return <ScriptJsonEditor uiScale={uiScale} />;
            case DOCK_PANELS.preview:
                return <GamePreview script={rootScript} />;
            case DOCK_PANELS.inspector:
                return <Inspector />;
            case DOCK_PANELS.assets:
                return <AssetPreviewPanel uiScale={uiScale} />;
            case DOCK_PANELS.console:
                return <ConsolePanel />;
            default:
                return <div style={{ padding: 10, color: '#fca5a5' }}>Unknown panel: {String(comp)}</div>;
        }
    };

    return (
        <div
            className="zerith-dock-host"
            style={{
                height: '100%',
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                fontSize: `calc(12px * var(--ui-scale, 1))`,
            }}
        >
            <TopChrome />
            <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
                <Layout model={model} factory={factory} onModelChange={onModelChange} />
            </div>
        </div>
    );
}
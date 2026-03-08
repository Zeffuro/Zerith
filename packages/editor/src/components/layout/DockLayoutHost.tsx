import { Suspense, lazy, useEffect, useRef } from 'react';
import { Layout, Model, TabNode, Actions } from 'flexlayout-react';
import 'flexlayout-react/style/dark.css';

import { useEditorStore } from '../../store/useEditorStore';
import { useScriptStore } from '../../store/useScriptStore';
import { useWorkbenchStore } from '../../store/useWorkbenchStore';
import { DOCK_PANELS } from './dock/dockPanelIds';

import { TopChrome } from './TopChrome';
import { WorkbenchTabs } from './workbench/WorkbenchTabs';
import { EditorSurface } from './EditorSurface';

import { Explorer } from './explorer/Explorer';
import { Inspector } from '../inspector/Inspector';
import { ConsolePanel } from '../tools/ConsolePanel';

const GamePreview = lazy(() => import('../GamePreview').then((m) => ({ default: m.GamePreview })));

export function DockLayoutHost() {
    const dockLayoutJson = useEditorStore((s) => s.dockLayoutJson);
    const setDockLayoutJson = useEditorStore((s) => s.setDockLayoutJson);
    const rootScript = useScriptStore((s) => s.rootScript);
    const activeWorkbenchTabId = useWorkbenchStore((s) => s.activeTabId);

    const modelRef = useRef<Model | null>(null);
    const lastJsonRef = useRef<string>('');

    const jsonSig = JSON.stringify(dockLayoutJson);

    // create once
    if (!modelRef.current) {
        modelRef.current = Model.fromJson(dockLayoutJson);
        lastJsonRef.current = jsonSig;
    }

    // rebuild only when store layout changed externally (e.g. reset)
    if (lastJsonRef.current !== jsonSig) {
        modelRef.current = Model.fromJson(dockLayoutJson);
        lastJsonRef.current = jsonSig;
    }

    const model = modelRef.current!;
    const saveTimerRef = useRef<number | null>(null);

    const onModelChange = (m: Model) => {
        if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = window.setTimeout(() => {
            const next = m.toJson();
            const nextSig = JSON.stringify(next);
            if (nextSig !== lastJsonRef.current) {
                setDockLayoutJson(next);
                lastJsonRef.current = nextSig;
            }
            saveTimerRef.current = null;
        }, 180);
    };

    useEffect(() => {
        return () => {
            if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
        };
    }, []);

    useEffect(() => {
        if (!activeWorkbenchTabId) return;
        const tabNode = model.getNodeById(DOCK_PANELS.editor) as TabNode | undefined;
        if (!tabNode) return;
        model.doAction(Actions.selectTab(DOCK_PANELS.editor));
    }, [activeWorkbenchTabId, model]);

    const factory = (node: TabNode) => {
        const comp = node.getComponent() as string;

        switch (comp) {
            case DOCK_PANELS.explorer:
                return <Explorer />;
            case DOCK_PANELS.editor:
                return <EditorSurface />;
            case DOCK_PANELS.preview:
                return (
                    <Suspense fallback={<div style={{ padding: 12, opacity: 0.7 }}>Loading preview...</div>}>
                        <GamePreview script={rootScript} />
                    </Suspense>
                );
            case DOCK_PANELS.inspector:
                return <Inspector />;
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
            <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <WorkbenchTabs />
                <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
                    <Layout model={model} factory={factory} onModelChange={onModelChange} />
                </div>
            </div>
        </div>
    );
}
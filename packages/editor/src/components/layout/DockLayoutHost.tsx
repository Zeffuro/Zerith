import { Actions, Layout, Model, TabNode } from 'flexlayout-react';
import { lazy, Suspense, useEffect, useRef } from 'react';
import 'flexlayout-react/style/dark.css';

import { useEditorStore } from '../../store/useEditorStore';
import { useScriptStore } from '../../store/useScriptStore';
import { useWorkbenchStore } from '../../store/useWorkbenchStore';
import { Inspector } from '../inspector/Inspector';
import { ConsolePanel } from '../tools/ConsolePanel';
import { DOCK_PANELS } from './dock/dockPanelIds';
import { EditorSurface } from './EditorSurface';
import { Explorer } from './explorer/Explorer';
import { TopChrome } from './TopChrome';
import { WorkbenchTabs } from './workbench/WorkbenchTabs';

const GamePreview = lazy(() => import('../GamePreview').then((m) => ({ default: m.GamePreview })));

export function DockLayoutHost() {
    const dockLayoutJson = useEditorStore((s) => s.dockLayoutJson);
    const setDockLayoutJson = useEditorStore((s) => s.setDockLayoutJson);
    const rootScript = useScriptStore((s) => s.rootScript);
    const activeWorkbenchTabId = useWorkbenchStore((s) => s.activeTabId);

    const modelReference = useRef<Model | null>(null);
    const lastJsonReference = useRef<string>('');

    const jsonSig = JSON.stringify(dockLayoutJson);

    // create once
    if (!modelReference.current) {
        modelReference.current = Model.fromJson(dockLayoutJson);
        lastJsonReference.current = jsonSig;
    }

    // rebuild only when store layout changed externally (e.g. reset)
    if (lastJsonReference.current !== jsonSig) {
        modelReference.current = Model.fromJson(dockLayoutJson);
        lastJsonReference.current = jsonSig;
    }

    const model = modelReference.current;
    const saveTimerReference = useRef<null | number>(null);

    const onModelChange = (m: Model) => {
        if (saveTimerReference.current) globalThis.clearTimeout(saveTimerReference.current);
        saveTimerReference.current = globalThis.setTimeout(() => {
            const next = m.toJson();
            const nextSig = JSON.stringify(next);
            if (nextSig !== lastJsonReference.current) {
                setDockLayoutJson(next);
                lastJsonReference.current = nextSig;
            }
            saveTimerReference.current = null;
        }, 180);
    };

    useEffect(() => {
        return () => {
            if (saveTimerReference.current) globalThis.clearTimeout(saveTimerReference.current);
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
            case DOCK_PANELS.console: {
                return <ConsolePanel />;
            }
            case DOCK_PANELS.editor: {
                return <EditorSurface />;
            }
            case DOCK_PANELS.explorer: {
                return <Explorer />;
            }
            case DOCK_PANELS.inspector: {
                return <Inspector />;
            }
            case DOCK_PANELS.preview: {
                return (
                    <Suspense fallback={<div style={{ opacity: 0.7, padding: 12 }}>Loading preview...</div>}>
                        <GamePreview script={rootScript} />
                    </Suspense>
                );
            }
            default: {
                return <div style={{ color: '#fca5a5', padding: 10 }}>Unknown panel: {String(comp)}</div>;
            }
        }
    };

    return (
        <div
            className="zerith-dock-host"
            style={{
                display: 'flex',
                flexDirection: 'column',
                fontSize: `calc(12px * var(--ui-scale, 1))`,
                height: '100%',
                minHeight: 0,
                overflow: 'hidden',
            }}
        >
            <TopChrome />
            <div style={{ display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0, position: 'relative' }}>
                <WorkbenchTabs />
                <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                    <Layout factory={factory} model={model} onModelChange={onModelChange} />
                </div>
            </div>
        </div>
    );
}
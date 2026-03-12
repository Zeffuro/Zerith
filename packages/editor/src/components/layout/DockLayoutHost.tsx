import type { IJsonModel } from 'flexlayout-react';
import type { ReactNode } from 'react';

import { Actions, Layout, Model, TabNode } from 'flexlayout-react';
import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react';
import 'flexlayout-react/style/dark.css';

import { useDismissiblePopup } from '../../hooks/useDismissiblePopup';
import { useEditorStore } from '../../store/useEditorStore';
import { useScriptStore } from '../../store/useScriptStore';
import { useWorkbenchStore } from '../../store/useWorkbenchStore';
import { Inspector } from '../inspector/Inspector';
import { CommandPalette } from '../tools/CommandPalette';
import { ConsolePanel } from '../tools/ConsolePanel';
import { GlobalSearchContent, GlobalSearchPanel } from '../tools/GlobalSearchPanel';
import { ReferenceTrackerPanel } from '../tools/ReferenceTrackerPanel';
import { RuntimeMonitorPanel } from '../tools/RuntimeMonitorPanel';
import { StateObserverPanel } from '../tools/StateObserverPanel';
import { createDefaultDockLayout } from './dock/defaultDockLayout';
import { DOCK_PANELS } from './dock/dockPanelIds';
import { EditorSurface } from './EditorSurface';
import { Explorer } from './explorer/Explorer';
import { TopChrome } from './TopChrome';
import { WorkbenchTabs } from './workbench/WorkbenchTabs';

const GamePreview = lazy(() => import('../GamePreview').then((m) => ({ default: m.GamePreview })));

type InitialModelState = {
    jsonSig: string;
    model: Model;
    recoveryLayout: IJsonModel | undefined;
};

type LayoutErrorBoundaryProperties = {
    children: ReactNode;
    onRecover: () => void;
};

type LayoutErrorBoundaryState = {
    hasError: boolean;
};

type PopupPosition = {
    x: number;
    y: number;
};

class LayoutErrorBoundary extends Component<LayoutErrorBoundaryProperties, LayoutErrorBoundaryState> {
    public override state: LayoutErrorBoundaryState = { hasError: false };

    public static getDerivedStateFromError(): LayoutErrorBoundaryState {
        return { hasError: true };
    }

    public override componentDidCatch(error: unknown): void {
        console.error('Dock layout crashed, resetting to defaults.', error);
        this.props.onRecover();
    }

    public override render() {
        if (this.state.hasError) {
            return <div style={{ color: '#fca5a5', padding: 12 }}>Dock layout reset. Please reopen the panel.</div>;
        }
        return this.props.children;
    }
}


export function DockLayoutHost() {
    const closeCommandPalette = useEditorStore((s) => s.closeCommandPalette);
    const closeGlobalSearchPopup = useEditorStore((s) => s.closeGlobalSearchPopup);
    const dockLayoutJson = useEditorStore((s) => s.dockLayoutJson);
    const isCommandPaletteOpen = useEditorStore((s) => s.isCommandPaletteOpen);
    const isGlobalSearchPopupOpen = useEditorStore((s) => s.isGlobalSearchPopupOpen);
    const setDockLayoutJson = useEditorStore((s) => s.setDockLayoutJson);
    const uiScale = useEditorStore((s) => s.uiScale);
    const rootScript = useScriptStore((s) => s.rootScript);
    const activeWorkbenchTabId = useWorkbenchStore((s) => s.activeTabId);

    const [initialModelState] = useState(() => createInitialModelState(dockLayoutJson));
    const [globalSearchPopupPosition, setGlobalSearchPopupPosition] = useState<PopupPosition>();
    const [model, setModel] = useState<Model>(initialModelState.model);
    const [layoutRecoveryKey, setLayoutRecoveryKey] = useState(0);
    const lastJsonReference = useRef<string>(initialModelState.jsonSig);
    const globalSearchPopupReference = useRef<HTMLDivElement>(null);

    useDismissiblePopup(isGlobalSearchPopupOpen, globalSearchPopupReference, closeGlobalSearchPopup);

    useEffect(() => {
        if (!initialModelState.recoveryLayout) return;
        setDockLayoutJson(initialModelState.recoveryLayout);
    }, [initialModelState.recoveryLayout, setDockLayoutJson]);

    useEffect(() => {
        const incomingSig = safeJsonSignature(dockLayoutJson);
        if (incomingSig === undefined) return;

        // Ignore updates originating from this host's own onModelChange pipeline.
        if (incomingSig === lastJsonReference.current) {
            return;
        }

        try {
            const nextModel = Model.fromJson(dockLayoutJson as IJsonModel);
            queueMicrotask(() => {
                setModel(nextModel);
                setLayoutRecoveryKey((value) => value + 1);
            });
        } catch (error) {
            console.warn('Failed to apply incoming dock layout, resetting to defaults.', error);
            const fallbackLayout = createDefaultDockLayout() as IJsonModel;
            setDockLayoutJson(fallbackLayout);
            queueMicrotask(() => {
                setModel(Model.fromJson(fallbackLayout));
                setLayoutRecoveryKey((value) => value + 1);
            });
            lastJsonReference.current = JSON.stringify(fallbackLayout);
            return;
        }

        lastJsonReference.current = incomingSig;
    }, [dockLayoutJson, setDockLayoutJson]);

    const saveTimerReference = useRef<ReturnType<typeof globalThis.setTimeout> | undefined>(undefined);

    const handleGlobalSearchPopupDragStart = (event: React.MouseEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;

        const popupElement = globalSearchPopupReference.current;
        const containerElement = popupElement?.parentElement;
        if (!popupElement || !containerElement) return;

        event.preventDefault();

        const popupBounds = popupElement.getBoundingClientRect();
        const containerBounds = containerElement.getBoundingClientRect();
        const pointerOffsetX = event.clientX - popupBounds.left;
        const pointerOffsetY = event.clientY - popupBounds.top;

        const onPointerMove = (moveEvent: MouseEvent) => {
            const maxX = Math.max(0, containerBounds.width - popupBounds.width);
            const maxY = Math.max(0, containerBounds.height - popupBounds.height);

            const nextX = clamp(
                moveEvent.clientX - containerBounds.left - pointerOffsetX,
                0,
                maxX
            );
            const nextY = clamp(
                moveEvent.clientY - containerBounds.top - pointerOffsetY,
                0,
                maxY
            );

            setGlobalSearchPopupPosition({ x: nextX, y: nextY });
        };

        const onPointerUp = () => {
            document.removeEventListener('mousemove', onPointerMove);
            document.removeEventListener('mouseup', onPointerUp);
        };

        document.addEventListener('mousemove', onPointerMove);
        document.addEventListener('mouseup', onPointerUp);
    };

    const recoverLayout = () => {
        const fallbackLayout = createDefaultDockLayout() as IJsonModel;
        setDockLayoutJson(fallbackLayout);
        lastJsonReference.current = JSON.stringify(fallbackLayout);
        setLayoutRecoveryKey((value) => value + 1);
    };

    const onModelChange = (m: Model) => {
        if (saveTimerReference.current) globalThis.clearTimeout(saveTimerReference.current);
        saveTimerReference.current = globalThis.setTimeout(() => {
            const next = m.toJson();
            const nextSig = JSON.stringify(next);
            if (nextSig !== lastJsonReference.current) {
                setDockLayoutJson(next);
                lastJsonReference.current = nextSig;
            }
            saveTimerReference.current = undefined;
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

    useEffect(() => {
        const onDockSelect = (event: Event) => {
            const detail = (event as CustomEvent<unknown>).detail;
            if (typeof detail !== 'string') return;
            const tabNode = model.getNodeById(detail) as TabNode | undefined;
            if (!tabNode) return;
            model.doAction(Actions.selectTab(detail));
        };

        globalThis.addEventListener('zerith:dock-select', onDockSelect);
        return () => globalThis.removeEventListener('zerith:dock-select', onDockSelect);
    }, [model]);

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
            case DOCK_PANELS.globalSearch: {
                return <GlobalSearchPanel />;
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
            case DOCK_PANELS.referenceTracker: {
                return <ReferenceTrackerPanel />;
            }
            case DOCK_PANELS.runtimeMonitor: {
                return <RuntimeMonitorPanel />;
            }
            case DOCK_PANELS.stateObserver: {
                return <StateObserverPanel />;
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
                    <LayoutErrorBoundary key={layoutRecoveryKey} onRecover={recoverLayout}>
                        <Layout factory={factory} model={model} onModelChange={onModelChange} />
                    </LayoutErrorBoundary>

                    {isGlobalSearchPopupOpen && (
                        <div
                            ref={globalSearchPopupReference}
                            style={{
                                height: `min(70%, ${540 * uiScale}px)`,
                                left: globalSearchPopupPosition ? `${globalSearchPopupPosition.x}px` : '50%',
                                maxWidth: `min(90%, ${960 * uiScale}px)`,
                                minHeight: `${260 * uiScale}px`,
                                minWidth: `min(90%, ${560 * uiScale}px)`,
                                position: 'absolute',
                                top: globalSearchPopupPosition
                                    ? `${globalSearchPopupPosition.y}px`
                                    : `${18 * uiScale}px`,
                                transform: globalSearchPopupPosition ? undefined : 'translateX(-50%)',
                                width: '70%',
                                zIndex: 5000,
                            }}
                        >
                            <GlobalSearchContent
                                mode="popup"
                                onBeginDrag={handleGlobalSearchPopupDragStart}
                                onRequestClose={closeGlobalSearchPopup}
                            />
                        </div>
                    )}

                    {isCommandPaletteOpen && (
                        <CommandPalette onRequestClose={closeCommandPalette} uiScale={uiScale} />
                    )}
                </div>
            </div>
        </div>
    );
}


function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function createInitialModelState(layoutJson: unknown): InitialModelState {
    const fallbackLayout = createDefaultDockLayout() as IJsonModel;

    try {
        const parsed = layoutJson as IJsonModel;
        return {
            jsonSig: JSON.stringify(parsed),
            model: Model.fromJson(parsed),
            recoveryLayout: undefined,
        };
    } catch (error) {
        console.warn('Invalid dock layout detected, resetting to defaults.', error);
        return {
            jsonSig: JSON.stringify(fallbackLayout),
            model: Model.fromJson(fallbackLayout),
            recoveryLayout: fallbackLayout,
        };
    }
}


function safeJsonSignature(value: unknown): string | undefined {
    try {
        return JSON.stringify(value);
    } catch {
        return undefined;
    }
}



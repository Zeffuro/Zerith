import { X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { activateWorkbenchTab } from '../../../services/activateWorkbenchTab';
import { executeWorkbenchTabAction } from '../../../store/actions/workbenchTabActions';
import { useEditorStore } from '../../../store/useEditorStore';
import { useWorkbenchStore } from '../../../store/useWorkbenchStore';
import { editorTheme as t } from '../../../theme/editorTheme';

type ContextMenuState = {
    tabId: string;
    x: number;
    y: number;
} | null;

export function WorkbenchTabs() {
    const uiScale = useEditorStore((s) => s.uiScale);

    const { activeTabId, tabs } = useWorkbenchStore();

    const [context, setContext] = useState<ContextMenuState>(null);

    // drag state
    const [dragTabId, setDragTabId] = useState<null | string>(null);
    const [dropIndex, setDropIndex] = useState<null | number>(null);

    const stripReference = useRef<HTMLDivElement | null>(null);

    const tabIndexById = useMemo(
        () => new Map(tabs.map((tab, index) => [tab.id, index])),
        [tabs]
    );

    useEffect(() => {
        const onDocumentClick = () => setContext(null);
        const onEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setContext(null);
        };
        document.addEventListener('mousedown', onDocumentClick);
        document.addEventListener('keydown', onEsc);
        return () => {
            document.removeEventListener('mousedown', onDocumentClick);
            document.removeEventListener('keydown', onEsc);
        };
    }, []);

    if (tabs.length === 0) return null;

    const menuButtonStyle: React.CSSProperties = {
        background: 'transparent',
        border: 'none',
        borderRadius: t.radius.sm,
        color: t.text.normal,
        cursor: 'pointer',
        fontSize: `${12 * uiScale}px`,
        padding: `${6 * uiScale}px ${8 * uiScale}px`,
        textAlign: 'left',
        width: '100%',
    };

    return (
        <div
            className="zerith-scrollbar"
            onDragEnd={() => {
                setDragTabId(null);
                setDropIndex(null);
            }}
            onDragOver={(e) => {
                if (!dragTabId) return;
                e.preventDefault();

                const target = (e.target as HTMLElement).closest('[data-tab-id]');
                if (!target) {
                    setDropIndex(tabs.length);
                    return;
                }

                const targetId = target.dataset.tabId!;
                const index = tabIndexById.get(targetId);
                if (index === undefined) return;

                const rect = target.getBoundingClientRect();
                const before = e.clientX < rect.left + rect.width / 2;
                setDropIndex(before ? index : index + 1);
            }}
            onDrop={(e) => {
                if (!dragTabId || dropIndex === null) return;
                e.preventDefault();
                executeWorkbenchTabAction({ action: 'reorder', fromId: dragTabId, toIndex: dropIndex });
                setDragTabId(null);
                setDropIndex(null);
            }}
            ref={stripReference}
            style={{
                alignItems: 'center',
                background: t.bg.panel,
                borderBottom: `1px solid ${t.border.subtle}`,
                display: 'flex',
                gap: `${2 * uiScale}px`,
                overflowX: 'auto',
                padding: `${4 * uiScale}px`,
                position: 'relative',
            }}
        >
            {tabs.map((tab, index) => {
                const active = tab.id === activeTabId;
                const showDropBefore = dropIndex === index;
                const showDropAfter = dropIndex === index + 1 && index === tabs.length - 1;

                return (
                    <div key={tab.id} style={{ alignItems: 'stretch', display: 'flex' }}>
                        {showDropBefore && (
                            <div
                                style={{
                                    background: t.accent.primary,
                                    borderRadius: 2,
                                    marginRight: 2,
                                    width: 2,
                                }}
                            />
                        )}

                        <div
                            data-tab-id={tab.id}
                            draggable
                            onClick={() => void activateWorkbenchTab(tab.id)}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                setContext({ tabId: tab.id, x: e.clientX, y: e.clientY });
                                executeWorkbenchTabAction({ action: 'activate', tabId: tab.id });
                            }}
                            onDragStart={(e) => {
                                setDragTabId(tab.id);
                                e.dataTransfer.effectAllowed = 'move';
                                e.dataTransfer.setData('text/plain', tab.id);
                            }}
                            style={{
                                alignItems: 'center',
                                background: active ? t.bg.selected : t.bg.panelAlt,
                                border: `1px solid ${active ? t.border.accent : t.border.subtle}`,
                                borderRadius: t.radius.sm,
                                color: active ? t.text.primary : t.text.normal,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                gap: `${6 * uiScale}px`,
                                padding: `${4 * uiScale}px ${8 * uiScale}px`,
                                userSelect: 'none',
                                whiteSpace: 'nowrap',
                            }}
                            title={tab.path}
                        >
                            <span style={{ fontSize: `${12 * uiScale}px` }}>{tab.title}</span>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    executeWorkbenchTabAction({ action: 'close', tabId: tab.id });
                                }}
                                style={{
                                    alignItems: 'center',
                                    background: 'transparent',
                                    border: 'none',
                                    color: t.text.muted,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    padding: 0,
                                }}
                                title="Close"
                            >
                                <X size={12 * uiScale} />
                            </button>
                        </div>

                        {showDropAfter && (
                            <div
                                style={{
                                    background: t.accent.primary,
                                    borderRadius: 2,
                                    marginLeft: 2,
                                    width: 2,
                                }}
                            />
                        )}
                    </div>
                );
            })}

            {context && (
                <div
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{
                        background: t.bg.popup,
                        border: `1px solid ${t.border.normal}`,
                        borderRadius: t.radius.md,
                        boxShadow: t.shadow.popupStrong,
                        left: context.x,
                        minWidth: `${180 * uiScale}px`,
                        padding: `${6 * uiScale}px`,
                        position: 'fixed',
                        top: context.y,
                        zIndex: 5000,
                    }}
                >
                    <button
                        onClick={() => {
                            executeWorkbenchTabAction({ action: 'close', tabId: context.tabId });
                            setContext(null);
                        }}
                        style={menuButtonStyle}
                    >
                        Close
                    </button>

                    <button
                        onClick={() => {
                            executeWorkbenchTabAction({ action: 'closeOthers', tabId: context.tabId });
                            setContext(null);
                        }}
                        style={menuButtonStyle}
                    >
                        Close Others
                    </button>

                    <button
                        onClick={() => {
                            executeWorkbenchTabAction({ action: 'closeToRight', tabId: context.tabId });
                            setContext(null);
                        }}
                        style={menuButtonStyle}
                    >
                        Close Tabs to Right
                    </button>
                </div>
            )}
        </div>
    );
}

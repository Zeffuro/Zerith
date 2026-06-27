import { X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { activateWorkbenchTab } from '../../../services/activateWorkbenchTab';
import { executeWorkbenchTabAction } from '../../../store/actions/workbenchTabActions';
import { useProjectStore } from '../../../store/storeBootstrap';
import { useEditorStore } from '../../../store/useEditorStore';
import { useWorkbenchStore } from '../../../store/useWorkbenchStore';
import { editorTheme as t } from '../../../theme/editorTheme';

type ContextMenuState = {
    tabId: string;
    x: number;
    y: number;
} | undefined;

export function WorkbenchTabs() {
    const uiScale = useEditorStore((s) => s.uiScale);
    const dirtyFiles = useProjectStore((state) => state.dirtyFiles);

    const { activeTabId, tabs } = useWorkbenchStore();

    const [context, setContext] = useState<ContextMenuState>();

    const [dragTabId, setDragTabId] = useState<string | undefined>();
    const [dropIndex, setDropIndex] = useState<number | undefined>();

    const stripReference = useRef<HTMLDivElement | undefined>(undefined);

    const tabIndexById = useMemo(
        () => new Map(tabs.map((tab, index) => [tab.id, index])),
        [tabs]
    );

    useEffect(() => {
        const onDocumentClick = () => setContext(undefined);
        const onEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setContext(undefined);
        };
        document.addEventListener('mousedown', onDocumentClick);
        document.addEventListener('keydown', onEsc);
        return () => {
            document.removeEventListener('mousedown', onDocumentClick);
            document.removeEventListener('keydown', onEsc);
        };
    }, []);

    if (tabs.length === 0) return;

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
                setDragTabId(undefined);
                setDropIndex(undefined);
            }}
            onDragOver={(event) => {
                if (!dragTabId) return;
                event.preventDefault();

                const target = (event.target as Element | null)?.closest<HTMLElement>('[data-tab-id]');
                if (!target) {
                    setDropIndex(tabs.length);
                    return;
                }

                const targetId = target.dataset.tabId;
                if (!targetId) return;
                const index = tabIndexById.get(targetId);
                if (index === undefined) return;

                const rect = target.getBoundingClientRect();
                const before = event.clientX < rect.left + rect.width / 2;
                setDropIndex(before ? index : index + 1);
            }}
            onDrop={(event) => {
                if (!dragTabId || dropIndex === undefined) return;
                event.preventDefault();
                executeWorkbenchTabAction({ action: 'reorder', fromId: dragTabId, toIndex: dropIndex });
                setDragTabId(undefined);
                setDropIndex(undefined);
            }}
            ref={(element) => {
                stripReference.current = element ?? undefined;
            }}
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
                const dirty = Boolean(tab.dirty || dirtyFiles.has(tab.path));
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
                            onContextMenu={(event) => {
                                event.preventDefault();
                                setContext({ tabId: tab.id, x: event.clientX, y: event.clientY });
                                executeWorkbenchTabAction({ action: 'activate', tabId: tab.id });
                            }}
                            onDragStart={(event) => {
                                setDragTabId(tab.id);
                                event.dataTransfer.effectAllowed = 'move';
                                event.dataTransfer.setData('text/plain', tab.id);
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
                            title={dirty ? `${tab.path} (unsaved changes)` : tab.path}
                        >
                            <span style={{ fontSize: `${12 * uiScale}px` }}>
                                {tab.title}
                                {dirty ? <span aria-label="Unsaved changes" style={{ color: t.accent.yellow, marginLeft: `${4 * uiScale}px` }}>*</span> : undefined}
                            </span>

                            <button
                                onClick={(event) => {
                                    event.stopPropagation();
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
                    onMouseDown={(event) => event.stopPropagation()}
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
                            setContext(undefined);
                        }}
                        style={menuButtonStyle}
                    >
                        Close
                    </button>

                    <button
                        onClick={() => {
                            executeWorkbenchTabAction({ action: 'closeOthers', tabId: context.tabId });
                            setContext(undefined);
                        }}
                        style={menuButtonStyle}
                    >
                        Close Others
                    </button>

                    <button
                        onClick={() => {
                            executeWorkbenchTabAction({ action: 'closeToRight', tabId: context.tabId });
                            setContext(undefined);
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

import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useWorkbenchStore } from '../../../store/useWorkbenchStore';
import { useEditorStore } from '../../../store/useEditorStore';
import { editorTheme as t } from '../../../theme/editorTheme';
import { activateWorkbenchTab } from '../../../services/activateWorkbenchTab';

type ContextMenuState = {
    x: number;
    y: number;
    tabId: string;
} | null;

export function WorkbenchTabs() {
    const uiScale = useEditorStore((s) => s.uiScale);

    const {
        tabs,
        activeTabId,
        closeTab,
        closeOthers,
        closeToRight,
        setActiveTab,
    } = useWorkbenchStore();

    const [ctx, setCtx] = useState<ContextMenuState>(null);

    // drag state
    const [dragTabId, setDragTabId] = useState<string | null>(null);
    const [dropIndex, setDropIndex] = useState<number | null>(null);

    const stripRef = useRef<HTMLDivElement | null>(null);

    const tabIndexById = useMemo(
        () => new Map(tabs.map((tab, idx) => [tab.id, idx])),
        [tabs]
    );

    useEffect(() => {
        const onDocClick = () => setCtx(null);
        const onEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setCtx(null);
        };
        document.addEventListener('mousedown', onDocClick);
        document.addEventListener('keydown', onEsc);
        return () => {
            document.removeEventListener('mousedown', onDocClick);
            document.removeEventListener('keydown', onEsc);
        };
    }, []);

    if (tabs.length === 0) return null;

    const menuBtnStyle: React.CSSProperties = {
        width: '100%',
        border: 'none',
        background: 'transparent',
        color: t.text.normal,
        textAlign: 'left',
        padding: `${6 * uiScale}px ${8 * uiScale}px`,
        borderRadius: t.radius.sm,
        cursor: 'pointer',
        fontSize: `${12 * uiScale}px`,
    };

    const reorderTabs = (fromId: string, toIndexRaw: number) => {
        const fromIndex = tabIndexById.get(fromId);
        if (fromIndex === undefined) return;

        const list = [...tabs];
        const [moved] = list.splice(fromIndex, 1);

        let toIndex = toIndexRaw;
        if (fromIndex < toIndex) toIndex -= 1;
        toIndex = Math.max(0, Math.min(toIndex, list.length));

        list.splice(toIndex, 0, moved);

        // write back by replacing store tabs (small extension point)
        useWorkbenchStore.setState((state) => ({
            ...state,
            tabs: list,
            activeTabId: state.activeTabId ?? moved.id,
        }));
    };

    return (
        <div
            ref={stripRef}
            className="zerith-scrollbar"
            style={{
                display: 'flex',
                alignItems: 'center',
                overflowX: 'auto',
                gap: `${2 * uiScale}px`,
                padding: `${4 * uiScale}px`,
                borderBottom: `1px solid ${t.border.subtle}`,
                background: t.bg.panel,
                position: 'relative',
            }}
            onDragOver={(e) => {
                if (!dragTabId) return;
                e.preventDefault();

                const target = (e.target as HTMLElement).closest('[data-tab-id]') as HTMLElement | null;
                if (!target) {
                    setDropIndex(tabs.length);
                    return;
                }

                const targetId = target.dataset.tabId!;
                const idx = tabIndexById.get(targetId);
                if (idx === undefined) return;

                const rect = target.getBoundingClientRect();
                const before = e.clientX < rect.left + rect.width / 2;
                setDropIndex(before ? idx : idx + 1);
            }}
            onDrop={(e) => {
                if (!dragTabId || dropIndex === null) return;
                e.preventDefault();
                reorderTabs(dragTabId, dropIndex);
                setDragTabId(null);
                setDropIndex(null);
            }}
            onDragEnd={() => {
                setDragTabId(null);
                setDropIndex(null);
            }}
        >
            {tabs.map((tab, idx) => {
                const active = tab.id === activeTabId;
                const showDropBefore = dropIndex === idx;
                const showDropAfter = dropIndex === idx + 1 && idx === tabs.length - 1;

                return (
                    <div key={tab.id} style={{ display: 'flex', alignItems: 'stretch' }}>
                        {showDropBefore && (
                            <div
                                style={{
                                    width: 2,
                                    marginRight: 2,
                                    background: t.accent.primary,
                                    borderRadius: 2,
                                }}
                            />
                        )}

                        <div
                            data-tab-id={tab.id}
                            draggable
                            onDragStart={(e) => {
                                setDragTabId(tab.id);
                                e.dataTransfer.effectAllowed = 'move';
                                e.dataTransfer.setData('text/plain', tab.id);
                            }}
                            onClick={() => void activateWorkbenchTab(tab.id)}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                setCtx({ x: e.clientX, y: e.clientY, tabId: tab.id });
                                setActiveTab(tab.id);
                            }}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: `${6 * uiScale}px`,
                                padding: `${4 * uiScale}px ${8 * uiScale}px`,
                                borderRadius: t.radius.sm,
                                border: `1px solid ${active ? t.border.accent : t.border.subtle}`,
                                background: active ? t.bg.selected : t.bg.panelAlt,
                                color: active ? t.text.primary : t.text.normal,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                userSelect: 'none',
                            }}
                            title={tab.path}
                        >
                            <span style={{ fontSize: `${12 * uiScale}px` }}>{tab.title}</span>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    closeTab(tab.id);
                                }}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: t.text.muted,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
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
                                    width: 2,
                                    marginLeft: 2,
                                    background: t.accent.primary,
                                    borderRadius: 2,
                                }}
                            />
                        )}
                    </div>
                );
            })}

            {ctx && (
                <div
                    style={{
                        position: 'fixed',
                        top: ctx.y,
                        left: ctx.x,
                        zIndex: 5000,
                        minWidth: `${180 * uiScale}px`,
                        background: t.bg.popup,
                        border: `1px solid ${t.border.normal}`,
                        borderRadius: t.radius.md,
                        boxShadow: t.shadow.popupStrong,
                        padding: `${6 * uiScale}px`,
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <button
                        style={menuBtnStyle}
                        onClick={() => {
                            closeTab(ctx.tabId);
                            setCtx(null);
                        }}
                    >
                        Close
                    </button>

                    <button
                        style={menuBtnStyle}
                        onClick={() => {
                            closeOthers(ctx.tabId);
                            setCtx(null);
                        }}
                    >
                        Close Others
                    </button>

                    <button
                        style={menuBtnStyle}
                        onClick={() => {
                            closeToRight(ctx.tabId);
                            setCtx(null);
                        }}
                    >
                        Close Tabs to Right
                    </button>
                </div>
            )}
        </div>
    );
}

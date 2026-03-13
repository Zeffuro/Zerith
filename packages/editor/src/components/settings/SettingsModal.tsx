import { X } from 'lucide-react';
import { type MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from 'react';

import { useEditorStore } from '../../store/useEditorStore';
import { editorTheme as t } from '../../theme/editorTheme';
import { filterSettingsTree, settingsCatalog, type SettingsCategoryNode } from './settingsCatalog';

const panelDescriptions: Record<string, string> = {
    appearance: 'Theme and scale preferences.',
    'appearance-scale': 'Configure editor zoom and UI density.',
    'appearance-theme': 'Pick or customize a visual theme.',
    editor: 'Editor-wide behavior and code editing options.',
    'editor-behavior': 'Control editing and scripting behavior defaults.',
    'editor-monaco': 'Code editor features, fonts, and diagnostics.',
    general: 'Global runtime and project behavior.',
    'general-autosave': 'Autosave cadence and safe-save behavior.',
    'general-playback': 'Playback defaults for preview and debugging.',
    keymap: 'Customize keyboard shortcuts by action.',
};

export function SettingsModal() {
    const autosaveEnabled = useEditorStore((state) => state.autosaveEnabled);
    const autosaveIntervalMs = useEditorStore((state) => state.autosaveIntervalMs);
    const closeSettingsModal = useEditorStore((state) => state.closeSettingsModal);
    const isMuted = useEditorStore((state) => state.isMuted);
    const isSettingsModalOpen = useEditorStore((state) => state.isSettingsModalOpen);
    const themeKey = useEditorStore((state) => state.themeKey);
    const uiScale = useEditorStore((state) => state.uiScale);

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPanelId, setSelectedPanelId] = useState<string>('general');
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const dragStartReference = useRef<{ originX: number; originY: number; startX: number; startY: number } | undefined>(undefined);
    const modalWidth = Math.min(980 * uiScale, globalThis.innerWidth * 0.92);
    const modalHeight = Math.min(560 * uiScale, globalThis.innerHeight * 0.9);
    const sidebarWidth = Math.min(260 * uiScale, Math.max(180, modalWidth * 0.38));

    const filteredNodes = useMemo(
        () => filterSettingsTree(settingsCatalog, searchQuery),
        [searchQuery],
    );

    useEffect(() => {
        if (!isSettingsModalOpen) return;

        const firstVisiblePanelId = getFirstNodeId(filteredNodes) ?? 'general';
        const panelStillVisible = containsNodeId(filteredNodes, selectedPanelId);
        if (!panelStillVisible) {
            setSelectedPanelId(firstVisiblePanelId);
        }
    }, [filteredNodes, isSettingsModalOpen, selectedPanelId]);

    useEffect(() => {
        if (!isSettingsModalOpen) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                closeSettingsModal();
            }
        };

        globalThis.addEventListener('keydown', onKeyDown);
        return () => globalThis.removeEventListener('keydown', onKeyDown);
    }, [closeSettingsModal, isSettingsModalOpen]);

    useEffect(() => {
        if (!isSettingsModalOpen) return;
        setDragOffset({ x: 0, y: 0 });
    }, [isSettingsModalOpen]);

    useEffect(() => {
        if (!isSettingsModalOpen) return;

        const onResize = () => {
            setDragOffset((current) => clampDragOffset(current.x, current.y, modalWidth, modalHeight));
        };

        globalThis.addEventListener('resize', onResize);
        return () => globalThis.removeEventListener('resize', onResize);
    }, [isSettingsModalOpen, modalHeight, modalWidth]);

    if (!isSettingsModalOpen) return;

    const selectedDescription = panelDescriptions[selectedPanelId] ?? 'Settings panel in progress.';

    const beginDrag = (event: ReactMouseEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;
        if ((event.target as HTMLElement).closest('[data-settings-close="true"]')) return;

        dragStartReference.current = {
            originX: dragOffset.x,
            originY: dragOffset.y,
            startX: event.clientX,
            startY: event.clientY,
        };

        const onMouseMove = (moveEvent: MouseEvent) => {
            const dragStart = dragStartReference.current;
            if (!dragStart) return;

            const nextOffset = clampDragOffset(
                dragStart.originX + (moveEvent.clientX - dragStart.startX),
                dragStart.originY + (moveEvent.clientY - dragStart.startY),
                modalWidth,
                modalHeight,
            );

            setDragOffset(nextOffset);
        };

        const onMouseUp = () => {
            dragStartReference.current = undefined;
            globalThis.removeEventListener('mousemove', onMouseMove);
            globalThis.removeEventListener('mouseup', onMouseUp);
        };

        globalThis.addEventListener('mousemove', onMouseMove);
        globalThis.addEventListener('mouseup', onMouseUp);
    };

    return (
        <div
            onClick={closeSettingsModal}
            style={{
                background: 'rgba(0, 0, 0, 0.45)',
                display: 'grid',
                inset: 0,
                placeItems: 'center',
                position: 'fixed',
                zIndex: 3500,
            }}
        >
            <div
                onClick={(event) => event.stopPropagation()}
                style={{
                    background: t.bg.popup,
                    border: `1px solid ${t.border.normal}`,
                    borderRadius: t.radius.lg,
                    boxShadow: t.shadow.popupStrong,
                    color: t.text.primary,
                    display: 'grid',
                    gridTemplateColumns: `${sidebarWidth}px 1fr`,
                    height: `${modalHeight}px`,
                    maxHeight: '90vh',
                    maxWidth: '92vw',
                    overflow: 'hidden',
                    position: 'fixed',
                    width: `${modalWidth}px`,
                    top: `calc(50% + ${dragOffset.y}px)`,
                    left: `calc(50% + ${dragOffset.x}px)`,
                    transform: 'translate(-50%, -50%)',
                }}
            >
                <aside style={{ borderRight: `1px solid ${t.border.subtle}`, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ borderBottom: `1px solid ${t.border.subtle}`, padding: `${12 * uiScale}px` }}>
                        <div style={{ fontSize: `${14 * uiScale}px`, fontWeight: 700, marginBottom: `${8 * uiScale}px` }}>Settings</div>
                        <input
                            onChange={(event) => setSearchQuery(event.currentTarget.value)}
                            placeholder="Search settings"
                            style={{
                                background: t.bg.input,
                                border: `1px solid ${t.border.normal}`,
                                borderRadius: t.radius.md,
                                color: t.text.primary,
                                fontSize: `${12 * uiScale}px`,
                                outline: 'none',
                                padding: `${8 * uiScale}px`,
                                width: '100%',
                            }}
                            value={searchQuery}
                        />
                    </div>
                    <div style={{ flex: 1, overflow: 'auto', padding: `${8 * uiScale}px` }}>
                        {filteredNodes.length === 0 ? (
                            <div style={{ color: t.text.muted, fontSize: `${12 * uiScale}px`, padding: `${8 * uiScale}px` }}>
                                No matching settings.
                            </div>
                        ) : (
                            filteredNodes.map((node) => (
                                <SettingsTreeNode
                                    key={node.id}
                                    node={node}
                                    onSelect={setSelectedPanelId}
                                    selectedPanelId={selectedPanelId}
                                    uiScale={uiScale}
                                />
                            ))
                        )}
                    </div>
                </aside>
                <section style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <header
                        onMouseDown={beginDrag}
                        style={{
                            alignItems: 'center',
                            borderBottom: `1px solid ${t.border.subtle}`,
                            cursor: 'move',
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: `${12 * uiScale}px ${16 * uiScale}px`,
                            userSelect: 'none',
                        }}
                    >
                        <div style={{ fontSize: `${15 * uiScale}px`, fontWeight: 700 }}>{selectedDescription}</div>
                        <button
                            aria-label="Close settings"
                            data-settings-close="true"
                            onClick={closeSettingsModal}
                            style={{
                                background: t.bg.popup,
                                border: `1px solid ${t.border.normal}`,
                                borderRadius: t.radius.md,
                                color: t.text.primary,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: `${24 * uiScale}px`,
                                width: `${24 * uiScale}px`,
                                padding: 0,
                            }}
                        >
                            <X size={14 * uiScale} />
                        </button>
                    </header>
                    <div style={{ display: 'grid', gap: `${10 * uiScale}px`, padding: `${16 * uiScale}px` }}>
                        <ReadOnlySettingRow label="Theme" value={themeKey} uiScale={uiScale} />
                        <ReadOnlySettingRow label="UI Scale" value={`${Math.round(uiScale * 100)}%`} uiScale={uiScale} />
                        <ReadOnlySettingRow label="Autosave" value={autosaveEnabled ? 'Enabled' : 'Disabled'} uiScale={uiScale} />
                        <ReadOnlySettingRow
                            label="Autosave Interval"
                            value={`${Math.round(autosaveIntervalMs / 1000)} seconds`}
                            uiScale={uiScale}
                        />
                        <ReadOnlySettingRow label="Audio" value={isMuted ? 'Muted' : 'Unmuted'} uiScale={uiScale} />
                    </div>
                </section>
            </div>
        </div>
    );
}

function clampDragOffset(x: number, y: number, modalWidth: number, modalHeight: number): { x: number; y: number } {
    const maxX = Math.max(0, (globalThis.innerWidth - modalWidth) / 2);
    const maxY = Math.max(0, (globalThis.innerHeight - modalHeight) / 2);

    return {
        x: clamp(x, -maxX, maxX),
        y: clamp(y, -maxY, maxY),
    };
}

function clamp(value: number, min: number, max: number): number {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

type SettingsTreeNodeProperties = {
    node: SettingsCategoryNode;
    onSelect: (id: string) => void;
    selectedPanelId: string;
    uiScale: number;
};

function SettingsTreeNode({ node, onSelect, selectedPanelId, uiScale }: SettingsTreeNodeProperties) {
    const isSelected = selectedPanelId === node.id;

    return (
        <div>
            <button
                onClick={() => onSelect(node.id)}
                style={{
                    background: isSelected ? t.bg.selected : 'transparent',
                    border: `1px solid ${isSelected ? t.border.normal : 'transparent'}`,
                    borderRadius: t.radius.md,
                    color: isSelected ? t.text.primary : t.text.normal,
                    cursor: 'pointer',
                    display: 'block',
                    fontSize: `${12 * uiScale}px`,
                    padding: `${6 * uiScale}px ${8 * uiScale}px`,
                    textAlign: 'left',
                    width: '100%',
                }}
            >
                {node.label}
            </button>
            {node.children?.length ? (
                <div style={{ marginLeft: `${12 * uiScale}px`, marginTop: `${2 * uiScale}px` }}>
                    {node.children.map((child) => (
                        <SettingsTreeNode
                            key={child.id}
                            node={child}
                            onSelect={onSelect}
                            selectedPanelId={selectedPanelId}
                            uiScale={uiScale}
                        />
                    ))}
                </div>
            ) : undefined}
        </div>
    );
}

function ReadOnlySettingRow({ label, uiScale, value }: { label: string; uiScale: number; value: string }) {
    return (
        <div
            style={{
                alignItems: 'center',
                background: t.bg.popup,
                border: `1px solid ${t.border.subtle}`,
                borderRadius: t.radius.md,
                display: 'grid',
                gap: `${8 * uiScale}px`,
                gridTemplateColumns: `${170 * uiScale}px 1fr`,
                padding: `${10 * uiScale}px ${12 * uiScale}px`,
            }}
        >
            <span style={{ color: t.text.normal, fontSize: `${12 * uiScale}px` }}>{label}</span>
            <span style={{ color: t.text.primary, fontSize: `${12 * uiScale}px` }}>{value}</span>
        </div>
    );
}

function containsNodeId(nodes: readonly SettingsCategoryNode[], targetId: string): boolean {
    for (const node of nodes) {
        if (node.id === targetId) return true;
        if (node.children && containsNodeId(node.children, targetId)) return true;
    }

    return false;
}

function getFirstNodeId(nodes: readonly SettingsCategoryNode[]): string | undefined {
    const firstNode = nodes[0];
    if (!firstNode) return;
    if (firstNode.id) return firstNode.id;
    if (!firstNode.children?.length) return;
    return getFirstNodeId(firstNode.children);
}


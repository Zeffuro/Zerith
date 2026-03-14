import { X } from 'lucide-react';
import {
    type CSSProperties,
    type MouseEvent as ReactMouseEvent,
    type ReactNode,
    type RefObject,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

import { type GlobalShortcutCommand, keymapDisplayBindings } from '../../services/keymapRegistry';
import { parseShortcutChord, serializeShortcutChord, shortcutChordFromEvent } from '../../services/shortcutChord';
import { defaultSettings } from '../../store/settings/SettingsSchema';
import { useEditorStore } from '../../store/useEditorStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { editorTheme as t } from '../../theme/editorTheme';
import { ConfirmDialog } from '../ConfirmDialog';
import {
    buildConflictActionSequence,
    buildEffectiveKeymapRows,
    buildKeymapConflictEntries,
    filterKeymapRows,
    resolveAllKeymapConflicts,
    resolveConflictsForAction,
    setKeymapOverride,
    stepConflictAction,
} from './keymapModel';
import {
    buildSettingsLeafCountMap,
    buildSettingsNodeCountMap,
    filterSettingsTree,
    settingsCatalog,
    type SettingsCategoryNode,
} from './settingsCatalog';
import {
    getChangedSettingsControlIds,
    getChangedSettingsLeafPanelCounts,
    getMatchedSettingsControlIds,
    getMatchedSettingsPanelIds,
    getPanelSettingsControls,
    getVisibleSettingsControls,
    type SettingsControlId,
} from './settingsControlRegistry';
import {
    createResetAllKeymapOverridesConfirmation,
    createResetAllSettingsConfirmation,
    createResetCurrentPanelConfirmation,
    createResetShortcutConfirmation,
    type PendingSettingsReset,
} from './settingsResetConfirmModel';
import { runAllSettingsReset, runCurrentPanelReset } from './settingsResetRoutingModel';

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

type SettingsTreeNodeProperties = {
    badgeMode: 'changed' | 'hits';
    leafCountById: Record<string, number>;
    node: SettingsCategoryNode;
    onBadgeClick: (nodeId: string) => void;
    onSelect: (id: string) => void;
    selectedPanelId: string;
    showSearchHitBadges: boolean;
    uiScale: number;
};

export function SettingsModal() {
    const autosaveEnabled = useEditorStore((state) => state.autosaveEnabled);
    const autosaveIntervalMs = useEditorStore((state) => state.autosaveIntervalMs);
    const closeSettingsModal = useEditorStore((state) => state.closeSettingsModal);
    const isMuted = useEditorStore((state) => state.isMuted);
    const isSettingsModalOpen = useEditorStore((state) => state.isSettingsModalOpen);
    const setAutosaveEnabled = useEditorStore((state) => state.setAutosaveEnabled);
    const setAutosaveIntervalMs = useEditorStore((state) => state.setAutosaveIntervalMs);
    const setThemeKey = useEditorStore((state) => state.setThemeKey);
    const setUiScale = useEditorStore((state) => state.setUiScale);
    const themeKey = useEditorStore((state) => state.themeKey);
    const toggleMute = useEditorStore((state) => state.toggleMute);
    const uiScale = useEditorStore((state) => state.uiScale);
    const keymapOverrides = useSettingsStore((state) => state.keymapOverrides);
    const setKeymapOverrides = useSettingsStore((state) => state.setKeymapOverrides);
    const setSettingsMuted = useSettingsStore((state) => state.setIsMuted);

    const [searchQuery, setSearchQuery] = useState('');
    const [treeBadgeMode, setTreeBadgeMode] = useState<'changed' | 'hits'>('hits');
    const [showChangedOnlySettings, setShowChangedOnlySettings] = useState(false);
    const [showCustomizedOnly, setShowCustomizedOnly] = useState(false);
    const [selectedPanelId, setSelectedPanelId] = useState<string>('general');
    const [focusedControlId, setFocusedControlId] = useState<SettingsControlId | undefined>();
    const [focusedRowAction, setFocusedRowAction] = useState<GlobalShortcutCommand | undefined>();
    const [pendingReset, setPendingReset] = useState<PendingSettingsReset | undefined>();
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const detailContainerReference = useRef<HTMLDivElement | null>(null);
    const detailRowReferences = useRef<Partial<Record<SettingsControlId, HTMLDivElement | null>>>({});
    const rowReferences = useRef<Partial<Record<GlobalShortcutCommand, HTMLDivElement | null>>>({});
    const rowsContainerReference = useRef<HTMLDivElement | null>(null);
    const dragStartReference = useRef<{ originX: number; originY: number; startX: number; startY: number } | undefined>(undefined);
    const modalWidth = Math.min(980 * uiScale, globalThis.innerWidth * 0.92);
    const modalHeight = Math.min(560 * uiScale, globalThis.innerHeight * 0.9);
    const sidebarWidth = Math.min(260 * uiScale, Math.max(180, modalWidth * 0.38));

    const baseFilteredNodes = useMemo(
        () => filterSettingsTree(settingsCatalog, searchQuery),
        [searchQuery],
    );

    const keymapRows = useMemo(
        () => buildEffectiveKeymapRows(keymapDisplayBindings, keymapOverrides),
        [keymapOverrides],
    );

    const filteredKeymapRows = useMemo(
        () => filterKeymapRows(keymapRows, searchQuery, showCustomizedOnly),
        [keymapRows, searchQuery, showCustomizedOnly],
    );

    const conflictCount = useMemo(
        () => keymapRows.filter((row) => row.conflictsWith.length > 0).length,
        [keymapRows],
    );

    const conflictEntries = useMemo(
        () => buildKeymapConflictEntries(keymapRows),
        [keymapRows],
    );

    const conflictActionSequence = useMemo(
        () => buildConflictActionSequence(keymapRows),
        [keymapRows],
    );

    const matchedControlIds = useMemo(
        () => getMatchedSettingsControlIds(searchQuery, {
            autosaveEnabled,
            autosaveIntervalMs,
            isMuted,
            themeKey,
            uiScale,
        }),
        [autosaveEnabled, autosaveIntervalMs, isMuted, searchQuery, themeKey, uiScale],
    );

    const changedControlIds = useMemo(
        () => getChangedSettingsControlIds(
            {
                autosaveEnabled,
                autosaveIntervalMs,
                isMuted,
                themeKey,
                uiScale,
            },
            {
                autosaveEnabled: defaultSettings.autosaveEnabled,
                autosaveIntervalMs: defaultSettings.autosaveIntervalMs,
                isMuted: defaultSettings.isMuted,
                themeKey: defaultSettings.themeKey,
                uiScale: defaultSettings.uiScale,
            },
        ),
        [autosaveEnabled, autosaveIntervalMs, isMuted, themeKey, uiScale],
    );

    const contentMatchedPanelIds = useMemo(() => {
        const panelIds = getMatchedSettingsPanelIds(searchQuery, {
            autosaveEnabled,
            autosaveIntervalMs,
            isMuted,
            themeKey,
            uiScale,
        });

        if (filteredKeymapRows.length > 0) {
            panelIds.add('keymap');
        }

        return panelIds;
    }, [autosaveEnabled, autosaveIntervalMs, filteredKeymapRows.length, isMuted, searchQuery, themeKey, uiScale]);

    const focusActionRow = useCallback((action: GlobalShortcutCommand) => {
        setShowCustomizedOnly(false);
        setSearchQuery('');

        globalThis.setTimeout(() => {
            const row = rowReferences.current[action];
            if (!row) return;

            const rowsContainer = rowsContainerReference.current;
            if (rowsContainer) {
                scrollRowIntoContainer(row, rowsContainer);
            } else {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            setFocusedRowAction(action);
            globalThis.setTimeout(() => {
                setFocusedRowAction((current) => current === action ? undefined : current);
            }, 1200);
        }, 0);
    }, []);

    const jumpToConflict = useCallback((direction: 'next' | 'previous') => {
        const nextAction = stepConflictAction(conflictActionSequence, focusedRowAction, direction);
        if (!nextAction) return;
        focusActionRow(nextAction);
    }, [conflictActionSequence, focusActionRow, focusedRowAction]);

    const focusDetailControl = useCallback((controlId: SettingsControlId) => {
        globalThis.setTimeout(() => {
            const row = detailRowReferences.current[controlId];
            if (!row) return;

            const container = detailContainerReference.current;
            if (container) {
                scrollRowIntoContainer(row, container);
            } else {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }

            setFocusedControlId(controlId);
            globalThis.setTimeout(() => {
                setFocusedControlId((current) => current === controlId ? undefined : current);
            }, 1200);
        }, 0);
    }, []);

    const requestResetConfirmation = useCallback((nextReset: PendingSettingsReset) => {
        setPendingReset(nextReset);
    }, []);

    const cancelResetConfirmation = useCallback(() => {
        setPendingReset(undefined);
    }, []);

    const confirmResetConfirmation = useCallback(() => {
        if (!pendingReset) return;
        pendingReset.onConfirm();
        setPendingReset(undefined);
    }, [pendingReset]);

    const handleChangedBadgeClick = useCallback((nodeId: string) => {
        if (treeBadgeMode !== 'changed') return;

        if (nodeId === 'keymap') {
            const firstCustomized = keymapRows.find((row) => row.isCustomized)?.action;
            if (!firstCustomized) return;

            setSelectedPanelId('keymap');
            focusActionRow(firstCustomized);
            return;
        }

        const firstChangedControl = getPanelSettingsControls(nodeId).find((control) => changedControlIds.has(control));
        if (!firstChangedControl) return;

        setSelectedPanelId(nodeId);
        focusDetailControl(firstChangedControl);
    }, [changedControlIds, focusActionRow, focusDetailControl, keymapRows, treeBadgeMode]);

    const filteredNodes = useMemo(() => {
        const trimmedQuery = searchQuery.trim();
        if (trimmedQuery.length === 0) return baseFilteredNodes;

        const matchedIds = new Set<string>([
            ...collectNodeIds(baseFilteredNodes),
            ...contentMatchedPanelIds,
        ]);
        if (matchedIds.size === 0) return [];

        return buildSettingsTreeForMatchedIds(settingsCatalog, matchedIds);
    }, [baseFilteredNodes, contentMatchedPanelIds, searchQuery]);

    const filteredNodeLeafCounts = useMemo(
        () => buildSettingsLeafCountMap(filteredNodes),
        [filteredNodes],
    );

    const changedLeafCounts = useMemo(() => {
        const counts = getChangedSettingsLeafPanelCounts(
            {
                autosaveEnabled,
                autosaveIntervalMs,
                isMuted,
                themeKey,
                uiScale,
            },
            {
                autosaveEnabled: defaultSettings.autosaveEnabled,
                autosaveIntervalMs: defaultSettings.autosaveIntervalMs,
                isMuted: defaultSettings.isMuted,
                themeKey: defaultSettings.themeKey,
                uiScale: defaultSettings.uiScale,
            },
        );

        const keymapChangedCount = Object.keys(keymapOverrides).length;
        if (keymapChangedCount > 0) {
            counts.keymap = keymapChangedCount;
        }

        return counts;
    }, [autosaveEnabled, autosaveIntervalMs, isMuted, keymapOverrides, themeKey, uiScale]);


    const changedNodeCounts = useMemo(
        () => buildSettingsNodeCountMap(filteredNodes, changedLeafCounts),
        [changedLeafCounts, filteredNodes],
    );

    const settingsTreeBadgeCounts = treeBadgeMode === 'changed' ? changedNodeCounts : filteredNodeLeafCounts;

    const showSearchHitBadges = treeBadgeMode === 'changed' || searchQuery.trim().length > 0;

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
                if (pendingReset) return;
                closeSettingsModal();
                return;
            }

            if (event.key !== 'F7') return;
            if (selectedPanelId !== 'keymap') return;
            if (conflictActionSequence.length === 0) return;

            event.preventDefault();
            jumpToConflict(event.shiftKey ? 'previous' : 'next');
        };

        globalThis.addEventListener('keydown', onKeyDown);
        return () => globalThis.removeEventListener('keydown', onKeyDown);
    }, [closeSettingsModal, conflictActionSequence.length, isSettingsModalOpen, jumpToConflict, pendingReset, selectedPanelId]);

    useEffect(() => {
        if (!focusedRowAction) return;
        if (conflictActionSequence.includes(focusedRowAction)) return;
        setFocusedRowAction(undefined);
    }, [conflictActionSequence, focusedRowAction]);

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
    const showKeymapPanel = selectedPanelId === 'keymap';
    const activeConflictIndex = focusedRowAction ? conflictActionSequence.indexOf(focusedRowAction) : -1;

    const resetCurrentPanel = () => {
        runCurrentPanelReset(selectedPanelId, getPanelSettingsControls, {
            resetAudio: () => {
                setSettingsMuted(defaultSettings.isMuted);
                useEditorStore.setState({ isMuted: defaultSettings.isMuted });
            },
            resetAutosaveEnabled: () => setAutosaveEnabled(defaultSettings.autosaveEnabled),
            resetAutosaveIntervalMs: () => setAutosaveIntervalMs(defaultSettings.autosaveIntervalMs),
            resetKeymapOverrides: () => setKeymapOverrides(defaultSettings.keymapOverrides),
            resetTheme: () => setThemeKey(defaultSettings.themeKey),
            resetUiScale: () => setUiScale(defaultSettings.uiScale),
        });
    };

    const resetAllSettings = () => {
        runAllSettingsReset({
            resetAudio: () => {
                setSettingsMuted(defaultSettings.isMuted);
                useEditorStore.setState({ isMuted: defaultSettings.isMuted });
            },
            resetAutosaveEnabled: () => setAutosaveEnabled(defaultSettings.autosaveEnabled),
            resetAutosaveIntervalMs: () => setAutosaveIntervalMs(defaultSettings.autosaveIntervalMs),
            resetKeymapOverrides: () => setKeymapOverrides(defaultSettings.keymapOverrides),
            resetTheme: () => setThemeKey(defaultSettings.themeKey),
            resetUiScale: () => setUiScale(defaultSettings.uiScale),
        });
    };

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
                    left: `calc(50% + ${dragOffset.x}px)`,
                    maxHeight: '90vh',
                    maxWidth: '92vw',
                    overflow: 'hidden',
                    position: 'fixed',
                    top: `calc(50% + ${dragOffset.y}px)`,
                    transform: 'translate(-50%, -50%)',
                    width: `${modalWidth}px`,
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
                        <div style={{ alignItems: 'center', display: 'inline-flex', gap: `${6 * uiScale}px`, marginTop: `${8 * uiScale}px` }}>
                            <button
                                onClick={() => setTreeBadgeMode('hits')}
                                style={{
                                    background: treeBadgeMode === 'hits' ? t.bg.selected : t.bg.popup,
                                    border: `1px solid ${t.border.normal}`,
                                    borderRadius: t.radius.sm,
                                    color: t.text.primary,
                                    cursor: 'pointer',
                                    fontSize: `${11 * uiScale}px`,
                                    padding: `${3 * uiScale}px ${7 * uiScale}px`,
                                }}
                            >
                                Hits
                            </button>
                            <button
                                onClick={() => setTreeBadgeMode('changed')}
                                style={{
                                    background: treeBadgeMode === 'changed' ? t.bg.selected : t.bg.popup,
                                    border: `1px solid ${t.border.normal}`,
                                    borderRadius: t.radius.sm,
                                    color: t.text.primary,
                                    cursor: 'pointer',
                                    fontSize: `${11 * uiScale}px`,
                                    padding: `${3 * uiScale}px ${7 * uiScale}px`,
                                }}
                            >
                                Changed
                            </button>
                        </div>
                    </div>
                    <div className="zerith-scrollbar" style={{ flex: 1, overflow: 'auto', overscrollBehavior: 'contain', padding: `${8 * uiScale}px` }}>
                        {filteredNodes.length === 0 ? (
                            <div style={{ color: t.text.muted, fontSize: `${12 * uiScale}px`, padding: `${8 * uiScale}px` }}>
                                No matching settings.
                            </div>
                        ) : (
                            filteredNodes.map((node) => (
                                <SettingsTreeNode
                                    badgeMode={treeBadgeMode}
                                    key={node.id}
                                    leafCountById={settingsTreeBadgeCounts}
                                    node={node}
                                    onBadgeClick={handleChangedBadgeClick}
                                    onSelect={setSelectedPanelId}
                                    selectedPanelId={selectedPanelId}
                                    showSearchHitBadges={showSearchHitBadges}
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
                                alignItems: 'center',
                                background: t.bg.popup,
                                border: `1px solid ${t.border.normal}`,
                                borderRadius: t.radius.md,
                                color: t.text.primary,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                height: `${24 * uiScale}px`,
                                justifyContent: 'center',
                                padding: 0,
                                width: `${24 * uiScale}px`,
                            }}
                        >
                            <X size={14 * uiScale} />
                        </button>
                    </header>
                    <div style={{ borderBottom: `1px solid ${t.border.subtle}`, padding: `${10 * uiScale}px ${16 * uiScale}px` }}>
                        <div style={{ display: 'inline-flex', gap: `${8 * uiScale}px` }}>
                            <button
                                onClick={() => {
                                    requestResetConfirmation(createResetCurrentPanelConfirmation(resetCurrentPanel));
                                }}
                                style={{
                                    background: t.bg.popup,
                                    border: `1px solid ${t.border.normal}`,
                                    borderRadius: t.radius.md,
                                    color: t.text.primary,
                                    cursor: 'pointer',
                                    fontSize: `${12 * uiScale}px`,
                                    padding: `${6 * uiScale}px ${10 * uiScale}px`,
                                }}
                            >
                                Reset Current Panel
                            </button>
                            <button
                                onClick={() => {
                                    requestResetConfirmation(createResetAllSettingsConfirmation(resetAllSettings));
                                }}
                                style={{
                                    background: t.bg.popup,
                                    border: `1px solid ${t.border.normal}`,
                                    borderRadius: t.radius.md,
                                    color: t.text.primary,
                                    cursor: 'pointer',
                                    fontSize: `${12 * uiScale}px`,
                                    padding: `${6 * uiScale}px ${10 * uiScale}px`,
                                }}
                            >
                                Reset All Settings
                            </button>
                        </div>
                        {showKeymapPanel ? undefined : (
                            <label style={{ alignItems: 'center', color: t.text.normal, display: 'inline-flex', fontSize: `${12 * uiScale}px`, gap: `${6 * uiScale}px`, marginLeft: `${10 * uiScale}px` }}>
                                <input
                                    checked={showChangedOnlySettings}
                                    onChange={(event) => setShowChangedOnlySettings(event.currentTarget.checked)}
                                    type="checkbox"
                                />
                                Show changed only
                            </label>
                        )}
                    </div>
                    {showKeymapPanel ? (
                        <div style={{ display: 'grid', gap: `${10 * uiScale}px`, padding: `${16 * uiScale}px` }}>
                            <div style={{ color: t.text.muted, fontSize: `${12 * uiScale}px` }}>
                                Click a shortcut field and press the full key combination you want.
                            </div>
                            <button
                                onClick={() => {
                                    requestResetConfirmation(createResetAllKeymapOverridesConfirmation(() => {
                                        setKeymapOverrides({});
                                    }));
                                }}
                                style={{
                                    background: t.bg.popup,
                                    border: `1px solid ${t.border.normal}`,
                                    borderRadius: t.radius.md,
                                    color: t.text.primary,
                                    cursor: 'pointer',
                                    fontSize: `${12 * uiScale}px`,
                                    justifySelf: 'start',
                                    padding: `${6 * uiScale}px ${10 * uiScale}px`,
                                }}
                            >
                                Reset All To Defaults
                            </button>
                            <label style={{ alignItems: 'center', color: t.text.normal, display: 'inline-flex', fontSize: `${12 * uiScale}px`, gap: `${6 * uiScale}px` }}>
                                <input
                                    checked={showCustomizedOnly}
                                    onChange={(event) => setShowCustomizedOnly(event.currentTarget.checked)}
                                    type="checkbox"
                                />
                                Show customized only
                            </label>
                            {conflictCount > 0 ? (
                                <div style={{
                                    background: t.bg.danger,
                                    border: `1px solid ${t.border.accent}`,
                                    borderRadius: t.radius.md,
                                    color: t.text.primary,
                                    display: 'grid',
                                    fontSize: `${12 * uiScale}px`,
                                    gap: `${10 * uiScale}px`,
                                    padding: `${8 * uiScale}px ${10 * uiScale}px`,
                                }}>
                                    <div style={{ alignItems: 'center', display: 'flex', gap: `${10 * uiScale}px`, justifyContent: 'space-between' }}>
                                        <span>
                                            {conflictCount} shortcut conflict{conflictCount === 1 ? '' : 's'} detected. Conflicting rows are highlighted.
                                        </span>
                                        <div style={{ alignItems: 'center', display: 'inline-flex', gap: `${6 * uiScale}px` }}>
                                            <span style={{ color: t.text.muted, fontSize: `${11 * uiScale}px`, minWidth: `${70 * uiScale}px`, textAlign: 'right' }}>
                                                {`${activeConflictIndex >= 0 ? activeConflictIndex + 1 : 0}/${conflictActionSequence.length}`}
                                            </span>
                                            <button
                                                onClick={() => jumpToConflict('previous')}
                                                style={{
                                                    background: t.bg.popup,
                                                    border: `1px solid ${t.border.normal}`,
                                                    borderRadius: t.radius.md,
                                                    color: t.text.primary,
                                                    cursor: 'pointer',
                                                    fontSize: `${12 * uiScale}px`,
                                                    padding: `${5 * uiScale}px ${9 * uiScale}px`,
                                                    whiteSpace: 'nowrap',
                                                }}
                                                title="Previous conflict (Shift+F7)"
                                            >
                                                Prev
                                            </button>
                                            <button
                                                onClick={() => jumpToConflict('next')}
                                                style={{
                                                    background: t.bg.popup,
                                                    border: `1px solid ${t.border.normal}`,
                                                    borderRadius: t.radius.md,
                                                    color: t.text.primary,
                                                    cursor: 'pointer',
                                                    fontSize: `${12 * uiScale}px`,
                                                    padding: `${5 * uiScale}px ${9 * uiScale}px`,
                                                    whiteSpace: 'nowrap',
                                                }}
                                                title="Next conflict (F7)"
                                            >
                                                Next
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setKeymapOverrides(resolveAllKeymapConflicts(keymapDisplayBindings, keymapOverrides));
                                                }}
                                                style={{
                                                    background: t.bg.popup,
                                                    border: `1px solid ${t.accent.red}`,
                                                    borderRadius: t.radius.md,
                                                    color: t.accent.red,
                                                    cursor: 'pointer',
                                                    fontSize: `${12 * uiScale}px`,
                                                    padding: `${5 * uiScale}px ${9 * uiScale}px`,
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                Fix All
                                            </button>
                                        </div>
                                    </div>
                                    <div className="zerith-scrollbar" style={{ display: 'grid', gap: `${6 * uiScale}px`, maxHeight: `${96 * uiScale}px`, overflow: 'auto', overscrollBehavior: 'contain' }}>
                                        {conflictEntries.map((entry) => (
                                            <div key={entry.shortcut} style={{ alignItems: 'center', display: 'grid', gap: `${8 * uiScale}px`, gridTemplateColumns: '140px 1fr', lineHeight: 1.2 }}>
                                                <strong style={{ fontSize: `${12 * uiScale}px` }}>{formatShortcutChordLabel(entry.shortcut)}</strong>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: `${6 * uiScale}px` }}>
                                                    {entry.actions.map((action) => (
                                                        <button
                                                            key={action}
                                                            onClick={() => {
                                                                focusActionRow(action);
                                                            }}
                                                            style={{
                                                                background: t.bg.popup,
                                                                border: `1px solid ${t.border.normal}`,
                                                                borderRadius: t.radius.sm,
                                                                color: t.text.primary,
                                                                cursor: 'pointer',
                                                                fontSize: `${11 * uiScale}px`,
                                                                padding: `${3 * uiScale}px ${7 * uiScale}px`,
                                                            }}
                                                            title="Scroll to row"
                                                        >
                                                            {formatActionLabel(action)}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : undefined}
                            <div className="zerith-scrollbar" ref={rowsContainerReference} style={{ display: 'grid', gap: `${8 * uiScale}px`, maxHeight: `${420 * uiScale}px`, overflow: 'auto', overscrollBehavior: 'contain' }}>
                                {filteredKeymapRows.length === 0 ? (
                                    <div style={{ color: t.text.muted, fontSize: `${12 * uiScale}px` }}>
                                        No keymap shortcuts match this search.
                                    </div>
                                ) : filteredKeymapRows.map((row) => {
                                    return (
                                        <KeymapSettingRow
                                            action={row.action}
                                            conflictsWith={row.conflictsWith}
                                            defaultKey={row.defaultShortcut}
                                            isCustomized={row.isCustomized}
                                            isFocused={focusedRowAction === row.action}
                                            key={row.action}
                                            onReset={() => {
                                                requestResetConfirmation(createResetShortcutConfirmation(
                                                    formatActionLabel(row.action),
                                                    () => {
                                                        setKeymapOverrides(setKeymapOverride(keymapOverrides, row.action, ''));
                                                    },
                                                ));
                                            }}
                                            onResolveConflict={() => {
                                                setKeymapOverrides(resolveConflictsForAction(keymapDisplayBindings, keymapOverrides, row.action));
                                            }}
                                            onUpdate={(nextValue) => {
                                                setKeymapOverrides(setKeymapOverride(keymapOverrides, row.action, nextValue));
                                            }}
                                            rowReference={(element) => {
                                                rowReferences.current[row.action] = element;
                                            }}
                                            uiScale={uiScale}
                                            value={row.effectiveShortcut}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <SettingsDetailPanel
                            autosaveEnabled={autosaveEnabled}
                            autosaveIntervalMs={autosaveIntervalMs}
                            changedControlIds={changedControlIds}
                            detailContainerReference={detailContainerReference}
                            detailRowReferences={detailRowReferences}
                            focusedControlId={focusedControlId}
                            isMuted={isMuted}
                            matchedControlIds={matchedControlIds}
                            panelId={selectedPanelId}
                            searchQuery={searchQuery}
                            setAutosaveEnabled={setAutosaveEnabled}
                            setAutosaveIntervalMs={setAutosaveIntervalMs}
                            setThemeKey={setThemeKey}
                            setUiScale={setUiScale}
                            showChangedOnly={showChangedOnlySettings}
                            themeKey={themeKey}
                            toggleMute={toggleMute}
                            uiScale={uiScale}
                        />
                    )}
                </section>
            </div>
            <ConfirmDialog
                confirmText={pendingReset?.confirmText ?? 'Reset'}
                danger={pendingReset?.danger ?? true}
                message={pendingReset?.message ?? ''}
                onCancel={cancelResetConfirmation}
                onConfirm={confirmResetConfirmation}
                open={pendingReset !== undefined}
                title={pendingReset?.title ?? 'Reset Settings'}
                zIndex={3600}
            />
        </div>
    );
}

function buildSettingsTreeForMatchedIds(
    nodes: readonly SettingsCategoryNode[],
    matchedIds: ReadonlySet<string>,
): SettingsCategoryNode[] {
    return nodes
        .map((node) => selectMatchedNode(node, matchedIds))
        .filter((node): node is SettingsCategoryNode => node !== undefined);
}

function clamp(value: number, min: number, max: number): number {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}


function clampDragOffset(x: number, y: number, modalWidth: number, modalHeight: number): { x: number; y: number } {
    const maxX = Math.max(0, (globalThis.innerWidth - modalWidth) / 2);
    const maxY = Math.max(0, (globalThis.innerHeight - modalHeight) / 2);

    return {
        x: clamp(x, -maxX, maxX),
        y: clamp(y, -maxY, maxY),
    };
}

function cloneSettingsNode(node: SettingsCategoryNode): SettingsCategoryNode {
    return {
        ...node,
        children: node.children?.map(cloneSettingsNode),
    };
}

function collectNodeIds(nodes: readonly SettingsCategoryNode[]): string[] {
    const ids: string[] = [];

    for (const node of nodes) {
        ids.push(node.id);
        if (node.children?.length) {
            ids.push(...collectNodeIds(node.children));
        }
    }

    return ids;
}

function containsNodeId(nodes: readonly SettingsCategoryNode[], targetId: string): boolean {
    for (const node of nodes) {
        if (node.id === targetId) return true;
        if (node.children && containsNodeId(node.children, targetId)) return true;
    }

    return false;
}

function EditableSettingRow({
    children,
    controlId,
    detailRowReferences,
    isChanged = false,
    isFocused = false,
    label,
    uiScale,
}: {
    children: ReactNode;
    controlId: SettingsControlId;
    detailRowReferences: RefObject<Partial<Record<SettingsControlId, HTMLDivElement | null>>>;
    isChanged?: boolean;
    isFocused?: boolean;
    label: string;
    uiScale: number;
}) {
    return (
        <div
            ref={(element) => {
                detailRowReferences.current[controlId] = element;
            }}
            style={{
            alignItems: 'center',
            background: isChanged ? t.bg.selected : t.bg.popup,
            border: `1px solid ${isChanged ? t.border.accent : t.border.subtle}`,
            borderRadius: t.radius.md,
            boxShadow: isFocused ? `0 0 0 2px ${t.accent.primary}` : undefined,
            display: 'grid',
            gap: `${8 * uiScale}px`,
            gridTemplateColumns: `${170 * uiScale}px auto 1fr`,
            padding: `${10 * uiScale}px ${12 * uiScale}px`,
        }}>
            <span style={{ color: t.text.normal, fontSize: `${12 * uiScale}px` }}>{label}</span>
            <span
                style={{
                    alignItems: 'center',
                    background: t.accent.green,
                    borderRadius: t.radius.sm,
                    color: '#fff',
                    display: 'inline-flex',
                    fontSize: `${10 * uiScale}px`,
                    fontWeight: 700,
                    height: `${18 * uiScale}px`,
                    justifyContent: 'center',
                    letterSpacing: '.03em',
                    opacity: isChanged ? 1 : 0,
                    pointerEvents: 'none',
                    textTransform: 'uppercase',
                    visibility: isChanged ? 'visible' : 'hidden',
                    width: `${56 * uiScale}px`,
                }}
            >
                Changed
            </span>
            <div>{children}</div>
        </div>
    );
}

function formatActionLabel(action: string): string {
    return action
        .replaceAll(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/^./, (character) => character.toUpperCase());
}


function formatKeyLabel(value: string): string {
    if (value.length === 1) return value.toUpperCase();
    return value.replace(/^./, (character) => character.toUpperCase());
}

function formatShortcutChordLabel(rawValue: string): string {
    const parsed = parseShortcutChord(rawValue);
    if (!parsed) return rawValue;

    const parts = [
        parsed.requireMod ? 'Ctrl/Cmd' : undefined,
        parsed.requireAlt ? 'Alt' : undefined,
        parsed.requireShift ? 'Shift' : undefined,
        formatKeyLabel(parsed.key),
    ].filter((part): part is string => part !== undefined);

    return parts.join(' + ');
}

function getFirstNodeId(nodes: readonly SettingsCategoryNode[]): string | undefined {
    const firstNode = nodes[0];
    if (!firstNode) return;
    if (firstNode.id) return firstNode.id;
    if (!firstNode.children?.length) return;
    return getFirstNodeId(firstNode.children);
}

function KeymapSettingRow({
    action,
    conflictsWith,
    defaultKey,
    isCustomized,
    isFocused,
    onReset,
    onResolveConflict,
    onUpdate,
    rowReference,
    uiScale,
    value,
}: {
    action: GlobalShortcutCommand;
    conflictsWith: GlobalShortcutCommand[];
    defaultKey: string;
    isCustomized: boolean;
    isFocused: boolean;
    onReset: () => void;
    onResolveConflict: () => void;
    onUpdate: (nextValue: string) => void;
    rowReference: (element: HTMLDivElement | null) => void;
    uiScale: number;
    value: string;
}) {
    const hasConflict = conflictsWith.length > 0;

    return (
        <div ref={rowReference} style={{
            alignItems: 'center',
            background: isCustomized ? t.bg.selected : t.bg.popup,
            border: `1px solid ${hasConflict ? t.accent.red : (isCustomized ? t.border.accent : t.border.subtle)}`,
            borderRadius: t.radius.md,
            boxShadow: isFocused ? `0 0 0 2px ${t.accent.primary}` : undefined,
            display: 'grid',
            gap: `${8 * uiScale}px`,
            gridTemplateColumns: '1.4fr 72px 1fr 56px 56px',
            padding: `${8 * uiScale}px ${10 * uiScale}px`,
        }}>
            <span style={{ color: t.text.primary, fontSize: `${12 * uiScale}px` }} title={hasConflict ? `Conflicts with: ${conflictsWith.map(formatActionLabel).join(', ')}` : undefined}>
                {formatActionLabel(action)}
                {hasConflict ? ` (conflict)` : ''}
            </span>
            <span
                style={{
                    alignItems: 'center',
                    background: t.accent.green,
                    borderRadius: t.radius.sm,
                    color: '#fff',
                    display: 'inline-flex',
                    fontSize: `${10 * uiScale}px`,
                    fontWeight: 700,
                    height: `${18 * uiScale}px`,
                    justifyContent: 'center',
                    letterSpacing: '.03em',
                    opacity: isCustomized ? 1 : 0,
                    pointerEvents: isCustomized ? 'auto' : 'none',
                    textTransform: 'uppercase',
                    visibility: isCustomized ? 'visible' : 'hidden',
                    width: '100%',
                }}
                title={isCustomized ? `Default: ${formatShortcutChordLabel(defaultKey)}` : undefined}
            >
                Custom
            </span>
            <input
                onKeyDown={(event) => {
                    if (event.key === 'Backspace' || event.key === 'Delete') {
                        event.preventDefault();
                        onUpdate('');
                        return;
                    }

                    const chord = shortcutChordFromEvent(event);
                    if (!chord) return;

                    event.preventDefault();
                    onUpdate(serializeShortcutChord(chord));
                }}
                placeholder="Press shortcut"
                readOnly
                style={{
                    background: t.bg.input,
                    border: `1px solid ${isCustomized ? t.border.accent : t.border.normal}`,
                    borderRadius: t.radius.md,
                    color: t.text.primary,
                    fontSize: `${12 * uiScale}px`,
                    padding: `${6 * uiScale}px ${8 * uiScale}px`,
                    width: '100%',
                }}
                value={formatShortcutChordLabel(value)}
            />
            <button
                onClick={onReset}
                style={{
                    background: t.bg.popup,
                    border: `1px solid ${t.border.normal}`,
                    borderRadius: t.radius.md,
                    color: t.text.primary,
                    cursor: 'pointer',
                    fontSize: `${12 * uiScale}px`,
                    padding: `${5 * uiScale}px ${8 * uiScale}px`,
                    width: '100%',
                }}
                title={`Reset to default (${formatShortcutChordLabel(defaultKey)})`}
            >
                Reset
            </button>
            <button
                onClick={onResolveConflict}
                style={{
                    background: t.bg.popup,
                    border: `1px solid ${hasConflict ? t.accent.red : t.border.normal}`,
                    borderRadius: t.radius.md,
                    color: hasConflict ? t.accent.red : t.text.muted,
                    cursor: hasConflict ? 'pointer' : 'default',
                    fontSize: `${12 * uiScale}px`,
                    opacity: hasConflict ? 1 : 0,
                    padding: `${5 * uiScale}px ${8 * uiScale}px`,
                    pointerEvents: hasConflict ? 'auto' : 'none',
                    visibility: hasConflict ? 'visible' : 'hidden',
                    width: '100%',
                }}
                title={hasConflict ? `Resolve by keeping ${formatActionLabel(action)} and clearing conflicting overrides` : undefined}
            >
                Fix
            </button>
        </div>
    );
}

function scrollRowIntoContainer(row: HTMLDivElement, container: HTMLDivElement): void {
    const rowRect = row.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const visibilityMargin = 8;

    let nextTop = container.scrollTop;
    if (rowRect.top < containerRect.top + visibilityMargin) {
        nextTop += rowRect.top - containerRect.top - visibilityMargin;
    } else if (rowRect.bottom > containerRect.bottom - visibilityMargin) {
        nextTop += rowRect.bottom - containerRect.bottom + visibilityMargin;
    }

    const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);
    const clampedTop = clamp(nextTop, 0, maxTop);
    if (Math.abs(clampedTop - container.scrollTop) < 1) return;

    container.scrollTo({
        behavior: 'smooth',
        top: clampedTop,
    });
}

function selectMatchedNode(
    node: SettingsCategoryNode,
    matchedIds: ReadonlySet<string>,
): SettingsCategoryNode | undefined {
    if (matchedIds.has(node.id)) {
        return cloneSettingsNode(node);
    }

    const children = node.children
        ?.map((child) => selectMatchedNode(child, matchedIds))
        .filter((child): child is SettingsCategoryNode => child !== undefined);

    if (!children || children.length === 0) return;
    return {
        ...node,
        children,
    };
}

function SettingsDetailPanel({
    autosaveEnabled,
    autosaveIntervalMs,
    changedControlIds,
    detailContainerReference,
    detailRowReferences,
    focusedControlId,
    isMuted,
    matchedControlIds,
    panelId,
    searchQuery,
    setAutosaveEnabled,
    setAutosaveIntervalMs,
    setThemeKey,
    setUiScale,
    showChangedOnly,
    themeKey,
    toggleMute,
    uiScale,
}: {
    autosaveEnabled: boolean;
    autosaveIntervalMs: number;
    changedControlIds: ReadonlySet<string>;
    detailContainerReference: RefObject<HTMLDivElement | null>;
    detailRowReferences: RefObject<Partial<Record<SettingsControlId, HTMLDivElement | null>>>;
    focusedControlId: SettingsControlId | undefined;
    isMuted: boolean;
    matchedControlIds: ReadonlySet<string>;
    panelId: string;
    searchQuery: string;
    setAutosaveEnabled: (enabled: boolean) => void;
    setAutosaveIntervalMs: (intervalMs: number) => void;
    setThemeKey: (key: string) => void;
    setUiScale: (scale: number) => void;
    showChangedOnly: boolean;
    themeKey: string;
    toggleMute: () => void;
    uiScale: number;
}) {
    const visibleControlIds = new Set(getVisibleSettingsControls(panelId));
    const showThemeRow = visibleControlIds.has('theme') && matchedControlIds.has('theme');
    const showScaleRow = visibleControlIds.has('uiScale') && matchedControlIds.has('uiScale');
    const showAutosaveRow = visibleControlIds.has('autosaveEnabled') && matchedControlIds.has('autosaveEnabled');
    const showAutosaveIntervalRow = visibleControlIds.has('autosaveIntervalMs') && matchedControlIds.has('autosaveIntervalMs');
    const showAudioRow = visibleControlIds.has('audio') && matchedControlIds.has('audio');

    const themeChanged = changedControlIds.has('theme');
    const scaleChanged = changedControlIds.has('uiScale');
    const autosaveChanged = changedControlIds.has('autosaveEnabled');
    const autosaveIntervalChanged = changedControlIds.has('autosaveIntervalMs');
    const audioChanged = changedControlIds.has('audio');

    const withChangedFilter = (visible: boolean, isChanged: boolean): boolean => {
        if (!visible) return false;
        if (!showChangedOnly) return true;
        return isChanged;
    };

    const finalShowThemeRow = withChangedFilter(showThemeRow, themeChanged);
    const finalShowScaleRow = withChangedFilter(showScaleRow, scaleChanged);
    const finalShowAutosaveRow = withChangedFilter(showAutosaveRow, autosaveChanged);
    const finalShowAutosaveIntervalRow = withChangedFilter(showAutosaveIntervalRow, autosaveIntervalChanged);
    const finalShowAudioRow = withChangedFilter(showAudioRow, audioChanged);

    const hasEditableContent = finalShowThemeRow || finalShowScaleRow || finalShowAutosaveRow || finalShowAutosaveIntervalRow || finalShowAudioRow;
    if (!hasEditableContent) {
        return (
            <div style={{ display: 'grid', gap: `${10 * uiScale}px`, padding: `${16 * uiScale}px` }}>
                <div style={{ color: t.text.muted, fontSize: `${12 * uiScale}px` }}>
                    {showChangedOnly
                        ? 'No changed settings are visible in this panel for the current search.'
                        : `No settings in this panel match "${searchQuery.trim()}".`}
                </div>
            </div>
        );
    }

    return (
        <div className="zerith-scrollbar" ref={detailContainerReference} style={{ display: 'grid', gap: `${12 * uiScale}px`, overflow: 'auto', overscrollBehavior: 'contain', padding: `${16 * uiScale}px` }}>
            {finalShowThemeRow ? (
                <EditableSettingRow
                    controlId="theme"
                    detailRowReferences={detailRowReferences}
                    isChanged={themeChanged}
                    isFocused={focusedControlId === 'theme'}
                    label="Theme"
                    uiScale={uiScale}
                >
                    <select
                        onChange={(event) => setThemeKey(event.currentTarget.value)}
                        style={settingsInputStyle(uiScale)}
                        value={themeKey}
                    >
                        <option value="classic">Classic</option>
                        <option value="classicSoft">Classic Soft</option>
                    </select>
                </EditableSettingRow>
            ) : undefined}

            {finalShowScaleRow ? (
                <EditableSettingRow
                    controlId="uiScale"
                    detailRowReferences={detailRowReferences}
                    isChanged={scaleChanged}
                    isFocused={focusedControlId === 'uiScale'}
                    label="UI Scale"
                    uiScale={uiScale}
                >
                    <div style={{ alignItems: 'center', display: 'grid', gap: `${8 * uiScale}px`, gridTemplateColumns: '1fr auto' }}>
                        <input
                            max={1.5}
                            min={0.8}
                            onChange={(event) => setUiScale(Number(event.currentTarget.value))}
                            step={0.05}
                            style={{ width: '100%' }}
                            type="range"
                            value={uiScale}
                        />
                        <span style={{ color: t.text.primary, fontSize: `${12 * uiScale}px`, minWidth: `${48 * uiScale}px`, textAlign: 'right' }}>
                            {Math.round(uiScale * 100)}%
                        </span>
                    </div>
                </EditableSettingRow>
            ) : undefined}

            {finalShowAutosaveRow ? (
                <>
                    <EditableSettingRow
                        controlId="autosaveEnabled"
                        detailRowReferences={detailRowReferences}
                        isChanged={autosaveChanged}
                        isFocused={focusedControlId === 'autosaveEnabled'}
                        label="Autosave"
                        uiScale={uiScale}
                    >
                        <label style={{ alignItems: 'center', color: t.text.primary, display: 'inline-flex', fontSize: `${12 * uiScale}px`, gap: `${6 * uiScale}px` }}>
                            <input
                                checked={autosaveEnabled}
                                onChange={(event) => setAutosaveEnabled(event.currentTarget.checked)}
                                type="checkbox"
                            />
                            Enable autosave
                        </label>
                    </EditableSettingRow>

                    {finalShowAutosaveIntervalRow ? (
                        <EditableSettingRow
                            controlId="autosaveIntervalMs"
                            detailRowReferences={detailRowReferences}
                            isChanged={autosaveIntervalChanged}
                            isFocused={focusedControlId === 'autosaveIntervalMs'}
                            label="Autosave Interval"
                            uiScale={uiScale}
                        >
                            <select
                                onChange={(event) => setAutosaveIntervalMs(Number(event.currentTarget.value))}
                                style={settingsInputStyle(uiScale)}
                                value={autosaveIntervalMs}
                            >
                                <option value={15_000}>15 seconds</option>
                                <option value={30_000}>30 seconds</option>
                                <option value={60_000}>60 seconds</option>
                            </select>
                        </EditableSettingRow>
                    ) : undefined}
                </>
            ) : (finalShowAutosaveIntervalRow ? (
                <EditableSettingRow
                    controlId="autosaveIntervalMs"
                    detailRowReferences={detailRowReferences}
                    isChanged={autosaveIntervalChanged}
                    isFocused={focusedControlId === 'autosaveIntervalMs'}
                    label="Autosave Interval"
                    uiScale={uiScale}
                >
                        <select
                            onChange={(event) => setAutosaveIntervalMs(Number(event.currentTarget.value))}
                            style={settingsInputStyle(uiScale)}
                            value={autosaveIntervalMs}
                        >
                            <option value={15_000}>15 seconds</option>
                            <option value={30_000}>30 seconds</option>
                            <option value={60_000}>60 seconds</option>
                        </select>
                    </EditableSettingRow>
            ) : undefined)}

            {finalShowAudioRow ? (
                <EditableSettingRow
                    controlId="audio"
                    detailRowReferences={detailRowReferences}
                    isChanged={audioChanged}
                    isFocused={focusedControlId === 'audio'}
                    label="Audio"
                    uiScale={uiScale}
                >
                    <label style={{ alignItems: 'center', color: t.text.primary, display: 'inline-flex', fontSize: `${12 * uiScale}px`, gap: `${6 * uiScale}px` }}>
                        <input
                            checked={!isMuted}
                            onChange={(event) => {
                                const nextUnmuted = event.currentTarget.checked;
                                if (nextUnmuted === !isMuted) return;
                                toggleMute();
                            }}
                            type="checkbox"
                        />
                        Unmuted
                    </label>
                </EditableSettingRow>
            ) : undefined}
        </div>
    );
}


function settingsInputStyle(uiScale: number): CSSProperties {
    return {
        background: t.bg.input,
        border: `1px solid ${t.border.normal}`,
        borderRadius: t.radius.md,
        color: t.text.primary,
        fontSize: `${12 * uiScale}px`,
        padding: `${6 * uiScale}px ${8 * uiScale}px`,
        width: '100%',
    };
}

function SettingsTreeNode({ badgeMode, leafCountById, node, onBadgeClick, onSelect, selectedPanelId, showSearchHitBadges, uiScale }: SettingsTreeNodeProperties) {
    const isSelected = selectedPanelId === node.id;
    const leafCount = leafCountById[node.id] ?? 0;
    const showBadge = showSearchHitBadges && leafCount > 0;

    return (
        <div>
            <button
                onClick={() => onSelect(node.id)}
                style={{
                    alignItems: 'center',
                    background: isSelected ? t.bg.selected : 'transparent',
                    border: `1px solid ${isSelected ? t.border.normal : 'transparent'}`,
                    borderRadius: t.radius.md,
                    color: isSelected ? t.text.primary : t.text.normal,
                    cursor: 'pointer',
                    display: 'flex',
                    fontSize: `${12 * uiScale}px`,
                    justifyContent: 'space-between',
                    padding: `${6 * uiScale}px ${8 * uiScale}px`,
                    textAlign: 'left',
                    width: '100%',
                }}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.label}</span>
                <span
                    onClick={(event) => {
                        if (!showBadge || badgeMode !== 'changed') return;
                        event.preventDefault();
                        event.stopPropagation();
                        onBadgeClick(node.id);
                    }}
                    style={{
                        alignItems: 'center',
                        background: t.bg.input,
                        border: `1px solid ${t.border.subtle}`,
                        borderRadius: t.radius.sm,
                        color: t.text.muted,
                        cursor: showBadge && badgeMode === 'changed' ? 'pointer' : 'default',
                        display: 'inline-flex',
                        fontSize: `${11 * uiScale}px`,
                        justifyContent: 'center',
                        lineHeight: 1,
                        minWidth: `${24 * uiScale}px`,
                        opacity: showBadge ? 1 : 0,
                        padding: `${2 * uiScale}px ${5 * uiScale}px`,
                        pointerEvents: showBadge ? 'auto' : 'none',
                        textAlign: 'center',
                        visibility: showBadge ? 'visible' : 'hidden',
                    }}
                    title={showBadge
                        ? (badgeMode === 'changed'
                            ? `${leafCount} changed setting${leafCount === 1 ? '' : 's'}`
                            : `${leafCount} search hit${leafCount === 1 ? '' : 's'}`)
                        : undefined}
                >
                    {leafCount}
                </span>
            </button>
            {node.children?.length ? (
                <div style={{ marginLeft: `${12 * uiScale}px`, marginTop: `${2 * uiScale}px` }}>
                    {node.children.map((child) => (
                        <SettingsTreeNode
                            badgeMode={badgeMode}
                            key={child.id}
                            leafCountById={leafCountById}
                            node={child}
                            onBadgeClick={onBadgeClick}
                            onSelect={onSelect}
                            selectedPanelId={selectedPanelId}
                            showSearchHitBadges={showSearchHitBadges}
                            uiScale={uiScale}
                        />
                    ))}
                </div>
            ) : undefined}
        </div>
    );
}



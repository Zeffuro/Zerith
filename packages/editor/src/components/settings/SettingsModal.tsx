import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type GlobalShortcutCommand, keymapDisplayBindings } from '../../services/keymapRegistry';
import { defaultSettings } from '../../store/settings/SettingsSchema';
import { useEditorStore } from '../../store/useEditorStore';
import { useSettingsStore } from '../../store/useSettingsStore';
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
    buildSettingsTreeForMatchedIds,
    collectNodeIds,
    containsNodeId,
    filterSettingsTree,
    getFirstNodeId,
    settingsCatalog,
} from './settingsCatalog';
import {
    getChangedSettingsControlIds,
    getChangedSettingsLeafPanelCounts,
    getMatchedSettingsControlIds,
    getMatchedSettingsPanelIds,
    getPanelSettingsControls,
    type SettingsControlId,
} from './settingsControlRegistry';
import { formatActionLabel } from './SettingsKeymapRow';
import { SettingsModalMainPane } from './SettingsModalMainPane';
import { scrollRowIntoContainer } from './settingsModalScrollHelpers';
import { SettingsModalSidebar } from './SettingsModalSidebar';
import { SettingsModalWindow } from './SettingsModalWindow';
import {
    createResetAllKeymapOverridesConfirmation,
    createResetAllSettingsConfirmation,
    createResetCurrentPanelConfirmation,
    createResetShortcutConfirmation,
    type PendingSettingsReset,
} from './settingsResetConfirmModel';
import { runAllSettingsReset, runCurrentPanelReset } from './settingsResetRoutingModel';

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
    const addCustomTheme = useSettingsStore((state) => state.addCustomTheme);
    const customThemes = useSettingsStore((state) => state.customThemes);
    const deleteCustomTheme = useSettingsStore((state) => state.deleteCustomTheme);
    const keymapOverrides = useSettingsStore((state) => state.keymapOverrides);
    const setCustomThemes = useSettingsStore((state) => state.setCustomThemes);
    const setKeymapOverrides = useSettingsStore((state) => state.setKeymapOverrides);
    const setSettingsMuted = useSettingsStore((state) => state.setIsMuted);
    const updateCustomTheme = useSettingsStore((state) => state.updateCustomTheme);

    const [searchQuery, setSearchQuery] = useState('');
    const [treeBadgeMode, setTreeBadgeMode] = useState<'changed' | 'hits'>('hits');
    const [showChangedOnlySettings, setShowChangedOnlySettings] = useState(false);
    const [showCustomizedOnly, setShowCustomizedOnly] = useState(false);
    const [selectedPanelId, setSelectedPanelId] = useState<string>('general');
    const [focusedControlId, setFocusedControlId] = useState<SettingsControlId | undefined>();
    const [focusedRowAction, setFocusedRowAction] = useState<GlobalShortcutCommand | undefined>();
    const [pendingReset, setPendingReset] = useState<PendingSettingsReset | undefined>();
    const detailContainerReference = useRef<HTMLDivElement | null>(null);
    const detailRowReferences = useRef<Partial<Record<SettingsControlId, HTMLDivElement | null>>>({});
    const rowReferences = useRef<Partial<Record<GlobalShortcutCommand, HTMLDivElement | null>>>({});
    const rowsContainerReference = useRef<HTMLDivElement | null>(null);

    const baseFilteredNodes = useMemo(() => filterSettingsTree(settingsCatalog, searchQuery), [searchQuery]);
    const keymapRows = useMemo(() => buildEffectiveKeymapRows(keymapDisplayBindings, keymapOverrides), [keymapOverrides]);
    const filteredKeymapRows = useMemo(
        () => filterKeymapRows(keymapRows, searchQuery, showCustomizedOnly),
        [keymapRows, searchQuery, showCustomizedOnly],
    );
    const conflictCount = useMemo(() => keymapRows.filter((row) => row.conflictsWith.length > 0).length, [keymapRows]);
    const conflictEntries = useMemo(() => buildKeymapConflictEntries(keymapRows), [keymapRows]);
    const conflictActionSequence = useMemo(() => buildConflictActionSequence(keymapRows), [keymapRows]);

    const matchedControlIds = useMemo(
        () => getMatchedSettingsControlIds(searchQuery, { autosaveEnabled, autosaveIntervalMs, customThemes, isMuted, themeKey, uiScale }),
        [autosaveEnabled, autosaveIntervalMs, customThemes, isMuted, searchQuery, themeKey, uiScale],
    );

    const changedControlIds = useMemo(
        () => getChangedSettingsControlIds(
            { autosaveEnabled, autosaveIntervalMs, customThemes, isMuted, themeKey, uiScale },
            {
                autosaveEnabled: defaultSettings.autosaveEnabled,
                autosaveIntervalMs: defaultSettings.autosaveIntervalMs,
                customThemes: defaultSettings.customThemes,
                isMuted: defaultSettings.isMuted,
                themeKey: defaultSettings.themeKey,
                uiScale: defaultSettings.uiScale,
            },
        ),
        [autosaveEnabled, autosaveIntervalMs, customThemes, isMuted, themeKey, uiScale],
    );

    const contentMatchedPanelIds = useMemo(() => {
        const panelIds = getMatchedSettingsPanelIds(searchQuery, { autosaveEnabled, autosaveIntervalMs, customThemes, isMuted, themeKey, uiScale });
        if (filteredKeymapRows.length > 0) panelIds.add('keymap');
        return panelIds;
    }, [autosaveEnabled, autosaveIntervalMs, customThemes, filteredKeymapRows.length, isMuted, searchQuery, themeKey, uiScale]);

    const filteredNodes = useMemo(() => {
        if (searchQuery.trim().length === 0) return baseFilteredNodes;

        const matchedIds = new Set<string>([
            ...collectNodeIds(baseFilteredNodes),
            ...contentMatchedPanelIds,
        ]);
        if (matchedIds.size === 0) return [];
        return buildSettingsTreeForMatchedIds(settingsCatalog, matchedIds);
    }, [baseFilteredNodes, contentMatchedPanelIds, searchQuery]);

    const filteredNodeLeafCounts = useMemo(() => buildSettingsLeafCountMap(filteredNodes), [filteredNodes]);

    const changedLeafCounts = useMemo(() => {
        const counts = getChangedSettingsLeafPanelCounts(
            { autosaveEnabled, autosaveIntervalMs, customThemes, isMuted, themeKey, uiScale },
            {
                autosaveEnabled: defaultSettings.autosaveEnabled,
                autosaveIntervalMs: defaultSettings.autosaveIntervalMs,
                customThemes: defaultSettings.customThemes,
                isMuted: defaultSettings.isMuted,
                themeKey: defaultSettings.themeKey,
                uiScale: defaultSettings.uiScale,
            },
        );

        const keymapChangedCount = Object.keys(keymapOverrides).length;
        if (keymapChangedCount > 0) counts.keymap = keymapChangedCount;
        return counts;
    }, [autosaveEnabled, autosaveIntervalMs, customThemes, isMuted, keymapOverrides, themeKey, uiScale]);

    const changedNodeCounts = useMemo(() => buildSettingsNodeCountMap(filteredNodes, changedLeafCounts), [changedLeafCounts, filteredNodes]);
    const settingsTreeBadgeCounts = treeBadgeMode === 'changed' ? changedNodeCounts : filteredNodeLeafCounts;
    const showSearchHitBadges = treeBadgeMode === 'changed' || searchQuery.trim().length > 0;
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
    const requestResetConfirmation = useCallback((nextReset: PendingSettingsReset) => setPendingReset(nextReset), []);
    const cancelResetConfirmation = useCallback(() => setPendingReset(undefined), []);

    const confirmResetConfirmation = useCallback(() => {
        if (!pendingReset) return;
        pendingReset.onConfirm();
        setPendingReset(undefined);
    }, [pendingReset]);

    const setDetailRowReference = useCallback((controlId: SettingsControlId, element: HTMLDivElement | null) => {
        detailRowReferences.current[controlId] = element;
    }, []);

    const setKeymapRowReference = useCallback((action: GlobalShortcutCommand, element: HTMLDivElement | null) => {
        rowReferences.current[action] = element;
    }, []);
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
    useEffect(() => {
        if (!isSettingsModalOpen) return;

        const firstVisiblePanelId = getFirstNodeId(filteredNodes) ?? 'general';
        if (containsNodeId(filteredNodes, selectedPanelId)) return;

        globalThis.setTimeout(() => {
            setSelectedPanelId(firstVisiblePanelId);
        }, 0);
    }, [filteredNodes, isSettingsModalOpen, selectedPanelId]);
    useEffect(() => {
        if (!isSettingsModalOpen) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                if (pendingReset) return;
                closeSettingsModal();
                return;
            }

            if (event.key !== 'F7' || selectedPanelId !== 'keymap' || conflictActionSequence.length === 0) return;
            event.preventDefault();
            jumpToConflict(event.shiftKey ? 'previous' : 'next');
        };

        globalThis.addEventListener('keydown', onKeyDown);
        return () => globalThis.removeEventListener('keydown', onKeyDown);
    }, [closeSettingsModal, conflictActionSequence.length, isSettingsModalOpen, jumpToConflict, pendingReset, selectedPanelId]);
    useEffect(() => {
        if (!focusedRowAction) return;
        if (conflictActionSequence.includes(focusedRowAction)) return;

        globalThis.setTimeout(() => {
            setFocusedRowAction(undefined);
        }, 0);
    }, [conflictActionSequence, focusedRowAction]);
    if (!isSettingsModalOpen) return;

    const showKeymapPanel = selectedPanelId === 'keymap';

    const resetCurrentPanel = () => {
        runCurrentPanelReset(selectedPanelId, getPanelSettingsControls, {
            resetAudio: () => {
                setSettingsMuted(defaultSettings.isMuted);
                useEditorStore.setState({ isMuted: defaultSettings.isMuted });
            },
            resetAutosaveEnabled: () => setAutosaveEnabled(defaultSettings.autosaveEnabled),
            resetAutosaveIntervalMs: () => setAutosaveIntervalMs(defaultSettings.autosaveIntervalMs),
            resetCustomThemes: () => setCustomThemes(defaultSettings.customThemes),
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
            resetCustomThemes: () => setCustomThemes(defaultSettings.customThemes),
            resetKeymapOverrides: () => setKeymapOverrides(defaultSettings.keymapOverrides),
            resetTheme: () => setThemeKey(defaultSettings.themeKey),
            resetUiScale: () => setUiScale(defaultSettings.uiScale),
        });
    };

    return (
        <>
            <SettingsModalWindow onBackdropClick={closeSettingsModal} uiScale={uiScale}>
                {({ beginDrag }) => (
                    <>
                        <SettingsModalSidebar
                            filteredNodes={filteredNodes}
                            leafCountById={settingsTreeBadgeCounts}
                            onBadgeClick={handleChangedBadgeClick}
                            onSearchQueryChange={setSearchQuery}
                            onSelectPanel={setSelectedPanelId}
                            onTreeBadgeModeChange={setTreeBadgeMode}
                            searchQuery={searchQuery}
                            selectedPanelId={selectedPanelId}
                            showSearchHitBadges={showSearchHitBadges}
                            treeBadgeMode={treeBadgeMode}
                            uiScale={uiScale}
                        />
                        <SettingsModalMainPane
                            activeConflictIndex={focusedRowAction ? conflictActionSequence.indexOf(focusedRowAction) : -1}
                            autosaveEnabled={autosaveEnabled}
                            autosaveIntervalMs={autosaveIntervalMs}
                            changedControlIds={changedControlIds}
                            conflictActionSequenceLength={conflictActionSequence.length}
                            conflictCount={conflictCount}
                            conflictEntries={conflictEntries}
                            customThemes={customThemes}
                            detailContainerReference={detailContainerReference}
                            filteredKeymapRows={filteredKeymapRows}
                            focusedControlId={focusedControlId}
                            focusedRowAction={focusedRowAction}
                            isMuted={isMuted}
                            matchedControlIds={matchedControlIds}
                            onAddCustomTheme={addCustomTheme}
                            onBeginDrag={beginDrag}
                            onClose={closeSettingsModal}
                            onDeleteCustomTheme={deleteCustomTheme}
                            onFixAllConflicts={() => setKeymapOverrides(resolveAllKeymapConflicts(keymapDisplayBindings, keymapOverrides))}
                            onFocusActionRow={focusActionRow}
                            onJumpToConflict={jumpToConflict}
                            onRequestResetAllDefaults={() => {
                                requestResetConfirmation(createResetAllKeymapOverridesConfirmation(() => {
                                    setKeymapOverrides({});
                                }));
                            }}
                            onRequestResetAllSettings={() => {
                                requestResetConfirmation(createResetAllSettingsConfirmation(resetAllSettings));
                            }}
                            onRequestResetCurrentPanel={() => {
                                requestResetConfirmation(createResetCurrentPanelConfirmation(resetCurrentPanel));
                            }}
                            onRequestResetShortcut={(action) => {
                                requestResetConfirmation(createResetShortcutConfirmation(formatActionLabel(action), () => {
                                    setKeymapOverrides(setKeymapOverride(keymapOverrides, action, ''));
                                }));
                            }}
                            onResolveConflictForAction={(action) => {
                                setKeymapOverrides(resolveConflictsForAction(keymapDisplayBindings, keymapOverrides, action));
                            }}
                            onSetDetailRowReference={setDetailRowReference}
                            onSetRowReference={setKeymapRowReference}
                            onSetShowChangedOnlySettings={setShowChangedOnlySettings}
                            onSetShowCustomizedOnly={setShowCustomizedOnly}
                            onUpdateCustomTheme={updateCustomTheme}
                            onUpdateShortcut={(action, nextValue) => {
                                setKeymapOverrides(setKeymapOverride(keymapOverrides, action, nextValue));
                            }}
                            rowsContainerReference={rowsContainerReference}
                            searchQuery={searchQuery}
                            selectedPanelId={selectedPanelId}
                            setAutosaveEnabled={setAutosaveEnabled}
                            setAutosaveIntervalMs={setAutosaveIntervalMs}
                            setThemeKey={setThemeKey}
                            setUiScale={setUiScale}
                            showChangedOnlySettings={showChangedOnlySettings}
                            showCustomizedOnly={showCustomizedOnly}
                            showKeymapPanel={showKeymapPanel}
                            themeKey={themeKey}
                            toggleMute={toggleMute}
                            uiScale={uiScale}
                        />
                    </>
                )}
            </SettingsModalWindow>
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
        </>
    );
}

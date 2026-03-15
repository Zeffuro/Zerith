import { type KeyboardEventHandler, useCallback, useState } from 'react';

import { openProjectEntry } from '../../services/openProjectEntry';
import { useProjectStore } from '../../store/storeBootstrap';
import { useEditorStore } from '../../store/useEditorStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { editorTheme as t } from '../../theme/editorTheme';
import { buildCommandPaletteActions } from './commandPaletteActionsModel';
import { executeSelectedAction, reduceCommandPaletteKey } from './commandPaletteInteractionModel';
import { filterActions } from './commandPaletteModel';
import {
    clampRenderSelection,
    shouldShowEmptyActions,
    toRenderableActions,
} from './commandPalettePresentationModel';
import { openInitialProjectEntry } from './commandPaletteProjectEntry';

type Properties = {
    onRequestClose: () => void;
    uiScale: number;
};

export function CommandPalette({ onRequestClose, uiScale }: Properties) {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);

    const activeFile = useProjectStore((state) => state.activeFile);
    const openProjectFromManifest = useProjectStore((state) => state.openProjectFromManifest);
    const saveActiveFileFromCurrentScript = useProjectStore((state) => state.saveActiveFileFromCurrentScript);
    const saveAllDirtyFiles = useProjectStore((state) => state.saveAllDirtyFiles);

    const clearAllBreakpoints = useEditorStore((state) => state.clearAllBreakpoints);
    const isPlaybackPaused = useEditorStore((state) => state.isPlaybackPaused);
    const markManualSave = useEditorStore((state) => state.markManualSave);
    const openGlobalSearchPopup = useEditorStore((state) => state.openGlobalSearchPopup);
    const openGlobalSearchReplacePopup = useEditorStore((state) => state.openGlobalSearchReplacePopup);
    const openSettingsModal = useEditorStore((state) => state.openSettingsModal);
    const recentProjects = useSettingsStore((state) => state.recentProjects);
    const resetDockLayout = useEditorStore((state) => state.resetDockLayout);
    const addRecentProject = useEditorStore((state) => state.addRecentProject);
    const triggerPause = useEditorStore((state) => state.triggerPause);
    const triggerPlay = useEditorStore((state) => state.triggerPlay);
    const triggerResume = useEditorStore((state) => state.triggerResume);
    const triggerStep = useEditorStore((state) => state.triggerStep);
    const triggerStop = useEditorStore((state) => state.triggerStop);
    const playTrigger = useEditorStore((state) => state.playTrigger);
    const stopTrigger = useEditorStore((state) => state.stopTrigger);

    const isRunning = playTrigger > stopTrigger;

    const handleOpenInitialProjectEntry = useCallback(async () => {
        const { expandToPath, manifest, projectPath } = useProjectStore.getState();
        await openInitialProjectEntry({
            expandToPath,
            manifest,
            openProjectEntry,
            projectPath,
        });
    }, []);

    const actionDeps = {
        activeFile,
        addRecentProject,
        clearAllBreakpoints,
        isPlaybackPaused,
        isRunning,
        markManualSave,
        openGlobalSearchPopup,
        openGlobalSearchReplacePopup,
        openInitialProjectEntry: handleOpenInitialProjectEntry,
        openProjectFromManifest,
        openSettingsModal,
        recentProjects,
        resetDockLayout,
        saveActiveFileFromCurrentScript,
        saveAllDirtyFiles,
        triggerPause,
        triggerPlay,
        triggerResume,
        triggerStep,
        triggerStop,
    };

    const filteredActions = filterActions(buildCommandPaletteActions(actionDeps), query);

    const renderableActions = toRenderableActions(filteredActions);
    const clampedSelectedIndex = clampRenderSelection(selectedIndex, renderableActions.length);
    const showEmptyState = shouldShowEmptyActions(renderableActions.length);

    const handleActionClick = (index: number) => {
        void executeSelectedAction(filteredActions, index, onRequestClose);
    };

    const handleInputKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
        const interaction = reduceCommandPaletteKey(event.key, {
            actionCount: filteredActions.length,
            selectedIndex,
        });
        if (!interaction) return;

        event.preventDefault();

        if (interaction.kind === 'select') {
            setSelectedIndex(interaction.nextIndex);
            return;
        }

        if (interaction.kind === 'execute') {
            void executeSelectedAction(filteredActions, interaction.index, onRequestClose);
            return;
        }

        onRequestClose();
    };

    return (
        <div
            onClick={onRequestClose}
            style={{
                alignItems: 'flex-start',
                background: 'rgba(0, 0, 0, 0.45)',
                display: 'flex',
                height: '100%',
                justifyContent: 'center',
                left: 0,
                position: 'absolute',
                top: 0,
                width: '100%',
                zIndex: 5200,
            }}
        >
            <div
                onClick={(event) => event.stopPropagation()}
                style={{
                    background: t.bg.popup,
                    border: `1px solid ${t.border.normal}`,
                    borderRadius: t.radius.md,
                    boxShadow: t.shadow.popupStrong,
                    marginTop: `${52 * uiScale}px`,
                    maxHeight: `min(70vh, ${560 * uiScale}px)`,
                    maxWidth: `min(92vw, ${820 * uiScale}px)`,
                    overflow: 'hidden',
                    width: `min(92vw, ${680 * uiScale}px)`,
                }}
            >
                <input
                    autoFocus
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setSelectedIndex(0);
                    }}
                    onKeyDown={handleInputKeyDown}
                    placeholder="Type an action (e.g. Save All, Play, Reset Layout)"
                    style={{
                        background: t.bg.panel,
                        border: 'none',
                        borderBottom: `1px solid ${t.border.subtle}`,
                        color: t.text.normal,
                        fontSize: `${13 * uiScale}px`,
                        outline: 'none',
                        padding: `${10 * uiScale}px ${12 * uiScale}px`,
                        width: '100%',
                    }}
                    value={query}
                />

                <div className="zerith-scrollbar" style={{ maxHeight: `min(60vh, ${500 * uiScale}px)`, overflowY: 'auto' }}>
                    {showEmptyState && (
                        <div
                            style={{
                                color: t.text.faint,
                                fontStyle: 'italic',
                                padding: `${10 * uiScale}px ${12 * uiScale}px`,
                            }}
                        >
                            No matching commands
                        </div>
                    )}

                    {renderableActions.map((action, index) => {
                        const isActive = clampedSelectedIndex === index;
                        return (
                            <button
                                key={action.id}
                                onClick={() => {
                                    handleActionClick(index);
                                }}
                                style={{
                                    alignItems: 'center',
                                    background: isActive ? t.bg.selected : 'transparent',
                                    border: 'none',
                                    color: isActive ? t.text.primary : t.text.normal,
                                    cursor: 'pointer',
                                    display: 'grid',
                                    gap: `${10 * uiScale}px`,
                                    gridTemplateColumns: '1fr auto',
                                    padding: `${8 * uiScale}px ${12 * uiScale}px`,
                                    textAlign: 'left',
                                    width: '100%',
                                }}
                                type="button"
                            >
                                <span>{action.label}</span>
                                <span style={{ color: t.text.muted, fontSize: `${11 * uiScale}px` }}>{action.hintText}</span>
                            </button>
                        );
                    })}
                </div>

                <div
                    style={{
                        borderTop: `1px solid ${t.border.subtle}`,
                        color: t.text.muted,
                        fontSize: `${11 * uiScale}px`,
                        padding: `${8 * uiScale}px ${12 * uiScale}px`,
                    }}
                >
                    Enter to run - Esc to close - Up/Down to navigate
                </div>
            </div>
        </div>
    );
}

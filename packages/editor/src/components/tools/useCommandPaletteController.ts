import { useMemo, useState } from 'react';

import type { CommandPaletteViewProps as CommandPaletteViewProperties } from './CommandPaletteView';

import { openProjectEntry } from '../../services/openProjectEntry';
import { useProjectStore } from '../../store/storeBootstrap';
import { useEditorStore } from '../../store/useEditorStore';
import {
    buildCommandPaletteActionsDeps,
    buildCommandPaletteControllerInteractions,
    buildCommandPaletteFilteredActions,
    buildCommandPaletteInitialProjectEntryHandler,
    buildCommandPaletteOpenProjectEntryServiceHandler,
    buildCommandPaletteIsRunning,
    buildCommandPaletteSaveHandlers,
    buildCommandPaletteViewProps as buildCommandPaletteViewProperties,
} from './commandPaletteAdapters';

type UseCommandPaletteControllerArguments = {
    onRequestClose: () => void;
    uiScale: number;
};

export function useCommandPaletteController({
    onRequestClose,
    uiScale,
}: UseCommandPaletteControllerArguments): CommandPaletteViewProperties {
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
    const recentProjects = useEditorStore((state) => state.recentProjects);
    const resetDockLayout = useEditorStore((state) => state.resetDockLayout);
    const addRecentProject = useEditorStore((state) => state.addRecentProject);
    const triggerPause = useEditorStore((state) => state.triggerPause);
    const triggerPlay = useEditorStore((state) => state.triggerPlay);
    const triggerResume = useEditorStore((state) => state.triggerResume);
    const triggerStep = useEditorStore((state) => state.triggerStep);
    const triggerStop = useEditorStore((state) => state.triggerStop);

    const playTrigger = useEditorStore((state) => state.playTrigger);
    const stopTrigger = useEditorStore((state) => state.stopTrigger);

    const isRunning = buildCommandPaletteIsRunning({ playTrigger, stopTrigger });
    const openProjectEntryService = buildCommandPaletteOpenProjectEntryServiceHandler({
        openProjectEntryService: openProjectEntry,
    });
    const handleOpenInitialProjectEntry = buildCommandPaletteInitialProjectEntryHandler({
        getProjectState: () => useProjectStore.getState(),
        openProjectEntryService,
    });
    const saveHandlers = buildCommandPaletteSaveHandlers({
        saveActiveFileFromCurrentScript,
        saveAllDirtyFiles,
    });

    const actionDeps = buildCommandPaletteActionsDeps({
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
        saveActiveFileFromCurrentScript: saveHandlers.saveActiveFileFromCurrentScript,
        saveAllDirtyFiles: saveHandlers.saveAllDirtyFiles,
        triggerPause,
        triggerPlay,
        triggerResume,
        triggerStep,
        triggerStop,
    });
    const filteredActions = useMemo(
        () => buildCommandPaletteFilteredActions({ actionDeps, query }),
        [actionDeps, query],
    );
    const { handleActionClick, handleKeyDown } = buildCommandPaletteControllerInteractions({
        filteredActions,
        onRequestClose,
        selectedIndex,
        setSelectedIndex,
    });

    return buildCommandPaletteViewProperties({
        filteredActions,
        onInputKeyDown: handleKeyDown,
        onRequestClose,
        onRunAction: handleActionClick,
        query,
        selectedIndex,
        setQuery,
        setSelectedIndex,
        uiScale,
    });
}


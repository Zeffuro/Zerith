import type { EditorSet, UiPrefsSlice } from '../types';

import { MAX_RECENT_PROJECTS, sanitizeAutosaveInterval } from '../../settings/SettingsSchema';
import { useSettingsStore } from '../../useSettingsStore';

type SettingsSnapshot = ReturnType<typeof useSettingsStore.getState>;

export function createUiPrefsSlice(set: EditorSet): UiPrefsSlice {
    // Settings-backed prefs are sourced from the dedicated settings store.
    const { autosaveEnabled, autosaveIntervalMs, isMuted, recentProjects, themeKey, uiScale, windowState } = getSettingsSnapshot();

    return {
        addRecentProject: (manifestPath) => {
            const trimmedPath = manifestPath.trim();
            if (trimmedPath.length === 0) return;

            const normalizedPath = trimmedPath.replaceAll('\\', '/');
            const segments = normalizedPath.split('/').filter((segment) => segment.length > 0);
            const projectName = segments.at(-2) ?? segments.at(-1) ?? trimmedPath;

            const nextRecentProjects = [
                {
                    lastOpened: Date.now(),
                    name: projectName,
                    path: trimmedPath,
                },
                ...getSettingsSnapshot().recentProjects.filter((project) => project.path !== trimmedPath),
            ].slice(0, MAX_RECENT_PROJECTS);

            updateSettingsRecentProjects(nextRecentProjects);
            set({ recentProjects: nextRecentProjects });
        },
        autosaveEnabled,
        autosaveIntervalMs,
        clearProjectCloseRequest: () => set({ isProjectCloseRequested: false }),
        clearRecentProjects: () => {
            updateSettingsRecentProjects([]);
            set({ recentProjects: [] });
        },
        closeCommandPalette: () => set({ isCommandPaletteOpen: false }),
        closeExportGameModal: () => set({ isExportGameModalOpen: false }),
        closeGlobalSearchPopup: () => set({ isGlobalSearchPopupOpen: false }),
        closeNewProjectModal: () => set({ isNewProjectModalOpen: false }),
        closeSettingsModal: () => set({ isSettingsModalOpen: false }),
        globalSearchLaunchMode: 'find',
        isCommandPaletteOpen: false,
        isExportGameModalOpen: false,
        isGlobalSearchPopupOpen: false,
        isMuted,
        isNewProjectModalOpen: false,
        isProjectCloseRequested: false,
        isSettingsModalOpen: false,
        lastManualSaveAt: 0,
        markManualSave: () => set({ lastManualSaveAt: Date.now() }),
        openCommandPalette: () => set({ isCommandPaletteOpen: true }),
        openExportGameModal: () => set({ isExportGameModalOpen: true }),
        openGlobalSearchPopup: (globalSearchLaunchMode = 'find') =>
            set((state) => state.isSettingsModalOpen ? {} : { globalSearchLaunchMode, isGlobalSearchPopupOpen: true }),
        openGlobalSearchReplacePopup: () =>
            set((state) => state.isSettingsModalOpen ? {} : { globalSearchLaunchMode: 'replace', isGlobalSearchPopupOpen: true }),
        openNewProjectModal: () => set({ isNewProjectModalOpen: true }),
        openSettingsModal: () => set({ isGlobalSearchPopupOpen: false, isSettingsModalOpen: true }),
        previewLocale: undefined,
        recentProjects,
        requestProjectClose: () => set({ isProjectCloseRequested: true }),
        setAutosaveEnabled: (nextAutosaveEnabled) => {
            getSettingsSnapshot().setAutosaveEnabled(nextAutosaveEnabled);
            set({ autosaveEnabled: nextAutosaveEnabled });
        },
        setAutosaveIntervalMs: (nextAutosaveIntervalMs) => {
            const autosaveInterval = sanitizeAutosaveInterval(nextAutosaveIntervalMs);
            getSettingsSnapshot().setAutosaveIntervalMs(autosaveInterval);
            set({ autosaveIntervalMs: autosaveInterval });
        },
        setPreviewLocale: (previewLocale) => set({ previewLocale }),
        setThemeKey: (key) => {
            getSettingsSnapshot().setThemeKey(key);
            set({ themeKey: key });
        },
        setUiScale: (scale) => {
            getSettingsSnapshot().setUiScale(scale);
            set({ uiScale: scale });
        },
        setWindowState: (nextWindowState) => {
            getSettingsSnapshot().setWindowState(nextWindowState);
            set({ windowState: nextWindowState });
        },
        themeKey,
        toggleCommandPalette: () => set((state) => ({ isCommandPaletteOpen: !state.isCommandPaletteOpen })),
        toggleExportGameModal: () => set((state) => ({ isExportGameModalOpen: !state.isExportGameModalOpen })),
        toggleGlobalSearchPopup: () =>
            set((state) => state.isSettingsModalOpen ? {} : ({ isGlobalSearchPopupOpen: !state.isGlobalSearchPopupOpen })),
        toggleMute: () => set((state) => {
            const nextIsMuted = !state.isMuted;
            getSettingsSnapshot().setIsMuted(nextIsMuted);
            return { isMuted: nextIsMuted };
        }),
        toggleNewProjectModal: () => set((state) => ({ isNewProjectModalOpen: !state.isNewProjectModalOpen })),
        toggleSettingsModal: () => set((state) => ({ isSettingsModalOpen: !state.isSettingsModalOpen })),
        uiScale,
        windowState,
    };
}

function getSettingsSnapshot(): SettingsSnapshot {
    return useSettingsStore.getState();
}

function updateSettingsRecentProjects(recentProjects: SettingsSnapshot['recentProjects']): void {
    getSettingsSnapshot().setRecentProjects(recentProjects);
}


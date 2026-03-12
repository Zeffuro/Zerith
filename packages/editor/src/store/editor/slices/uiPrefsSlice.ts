import type { EditorSet, UiPrefsSlice } from '../types';

export function createUiPrefsSlice(set: EditorSet): UiPrefsSlice {
    return {
        addRecentProject: (manifestPath) => {
            const trimmedPath = manifestPath.trim();
            if (trimmedPath.length === 0) return;

            const normalizedPath = trimmedPath.replaceAll('\\', '/');
            const segments = normalizedPath.split('/').filter((segment) => segment.length > 0);
            const projectName = segments.at(-2) ?? segments.at(-1) ?? trimmedPath;

            set((state) => ({
                ...state,
                recentProjects: [
                    {
                        lastOpened: Date.now(),
                        name: projectName,
                        path: trimmedPath,
                    },
                    ...(Array.isArray(state.recentProjects)
                        ? state.recentProjects.filter((project) => project.path !== trimmedPath)
                        : []),
                ].slice(0, 12),
            }));
        },
        autosaveEnabled: false,
        autosaveIntervalMs: 30 * 1000,
        clearRecentProjects: () => set({ recentProjects: [] }),
        closeCommandPalette: () => set({ isCommandPaletteOpen: false }),
        closeGlobalSearchPopup: () => set({ isGlobalSearchPopupOpen: false }),
        globalSearchLaunchMode: 'find',
        isCommandPaletteOpen: false,
        isGlobalSearchPopupOpen: false,
        isMuted: false,
        lastManualSaveAt: 0,
        markManualSave: () => set({ lastManualSaveAt: Date.now() }),
        openCommandPalette: () => set({ isCommandPaletteOpen: true }),
        openGlobalSearchPopup: (globalSearchLaunchMode = 'find') => set({ globalSearchLaunchMode, isGlobalSearchPopupOpen: true }),
        openGlobalSearchReplacePopup: () => set({ globalSearchLaunchMode: 'replace', isGlobalSearchPopupOpen: true }),
        recentProjects: [],
        setAutosaveEnabled: (autosaveEnabled) => set({ autosaveEnabled }),
        setAutosaveIntervalMs: (autosaveIntervalMs) => set({ autosaveIntervalMs: Math.max(5 * 1000, Math.trunc(autosaveIntervalMs)) }),
        setThemeKey: (key) => set({ themeKey: key }),
        setUiScale: (scale) => set({ uiScale: scale }),
        setWindowState: (windowState) => set({ windowState }),
        themeKey: 'classic',
        toggleCommandPalette: () => set((state) => ({ isCommandPaletteOpen: !state.isCommandPaletteOpen })),
        toggleGlobalSearchPopup: () =>
            set((state) => ({ isGlobalSearchPopupOpen: !state.isGlobalSearchPopupOpen })),
        toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
        uiScale: 1,
        windowState: undefined,
    };
}


import type { EditorSet, UiPrefsSlice } from '../types';

export function createUiPrefsSlice(set: EditorSet): UiPrefsSlice {
    return {
        closeGlobalSearchPopup: () => set({ isGlobalSearchPopupOpen: false }),
        isGlobalSearchPopupOpen: false,
        isMuted: false,
        openGlobalSearchPopup: () => set({ isGlobalSearchPopupOpen: true }),
        setThemeKey: (key) => set({ themeKey: key }),
        setUiScale: (scale) => set({ uiScale: scale }),
        setWindowState: (windowState) => set({ windowState }),
        themeKey: 'classic',
        toggleGlobalSearchPopup: () =>
            set((state) => ({ isGlobalSearchPopupOpen: !state.isGlobalSearchPopupOpen })),
        toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
        uiScale: 1,
        windowState: undefined,
    };
}


import type { EditorSet, UiPrefsSlice } from '../types';

export function createUiPrefsSlice(set: EditorSet): UiPrefsSlice {
    return {
        uiScale: 1.0,
        isMuted: false,
        windowState: null,
        themeKey: 'classic',
        setUiScale: (scale) => set({ uiScale: scale }),
        toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
        setWindowState: (windowState) => set({ windowState }),
        setThemeKey: (key) => set({ themeKey: key }),
    };
}


import type { EditorSet, UiPrefsSlice } from '../types';

export function createUiPrefsSlice(set: EditorSet): UiPrefsSlice {
    return {
        isMuted: false,
        setThemeKey: (key) => set({ themeKey: key }),
        setUiScale: (scale) => set({ uiScale: scale }),
        setWindowState: (windowState) => set({ windowState }),
        themeKey: 'classic',
        toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
        uiScale: 1,
        windowState: undefined,
    };
}


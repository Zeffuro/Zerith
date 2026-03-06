import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface EditorState {
    uiScale: number;
    isMuted: boolean;
    windowState: { width: number; height: number; x: number; y: number; maximized: boolean } | null;

    playTrigger: number;
    stopTrigger: number;
    playFromIndex: number | null;
    triggerPlayFrom: (index: number) => void;

    quickCommandTypes: string[];
    setQuickCommandTypes: (types: string[]) => void;
    toggleQuickCommandType: (type: string) => void;
    moveQuickCommandType: (type: string, direction: 'left' | 'right') => void;

    setUiScale: (scale: number) => void;
    toggleMute: () => void;
    setWindowState: (state: EditorState['windowState']) => void;
    triggerPlay: () => void;
    triggerStop: () => void;

    themeKey: string;
    setThemeKey: (key: string) => void;
}

const DEFAULT_QUICK = ['dialogue', 'background', 'sprite', 'choice', 'if', 'while', 'for', 'jump', 'call', 'bgm'];

export const useEditorStore = create<EditorState>()(
    persist(
        (set, _) => ({
            uiScale: 1.0,
            isMuted: false,
            windowState: null,
            playTrigger: 0,
            stopTrigger: 0,
            playFromIndex: null,

            quickCommandTypes: DEFAULT_QUICK,

            setQuickCommandTypes: (types) =>
                set({ quickCommandTypes: Array.from(new Set(types.filter(Boolean))) }),

            toggleQuickCommandType: (type) =>
                set((state) => {
                    const has = state.quickCommandTypes.includes(type);
                    return {
                        quickCommandTypes: has
                            ? state.quickCommandTypes.filter((t) => t !== type)
                            : [...state.quickCommandTypes, type],
                    };
                }),

            moveQuickCommandType: (type, direction) =>
                set((state) => {
                    const list = [...state.quickCommandTypes];
                    const idx = list.indexOf(type);
                    if (idx < 0) return {};
                    const nextIdx = direction === 'left' ? idx - 1 : idx + 1;
                    if (nextIdx < 0 || nextIdx >= list.length) return {};
                    [list[idx], list[nextIdx]] = [list[nextIdx], list[idx]];
                    return { quickCommandTypes: list };
                }),

            setUiScale: (scale) => set({ uiScale: scale }),
            toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
            setWindowState: (ws) => set({ windowState: ws }),
            triggerStop: () => set((state) => ({ stopTrigger: state.stopTrigger + 1 })),
            triggerPlayFrom: (index) =>
                set((state) => ({
                    playTrigger: state.playTrigger + 1,
                    playFromIndex: index,
                })),

            triggerPlay: () =>
                set((state) => ({
                    playTrigger: state.playTrigger + 1,
                    playFromIndex: null,
                })),

            themeKey: 'classic',
            setThemeKey: (key) => set({ themeKey: key }),
        }),
        {
            name: 'zerith-editor-prefs',
            partialize: (state) => ({
                uiScale: state.uiScale,
                isMuted: state.isMuted,
                windowState: state.windowState,
                quickCommandTypes: state.quickCommandTypes,
                themeKey: state.themeKey,
            }),
            merge: (persisted, current) => {
                const merged = { ...current, ...(persisted as object) } as EditorState;
                if (!Array.isArray(merged.quickCommandTypes) || merged.quickCommandTypes.length === 0) {
                    merged.quickCommandTypes = DEFAULT_QUICK;
                }
                return merged;
            },
        }
    )
);
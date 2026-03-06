import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface EditorState {
    uiScale: number;
    isMuted: boolean;
    windowState: { width: number; height: number; x: number; y: number; maximized: boolean } | null;

    playTrigger: number;
    stopTrigger: number;

    setUiScale: (scale: number) => void;
    toggleMute: () => void;
    setWindowState: (state: EditorState['windowState']) => void;
    triggerPlay: () => void;
    triggerStop: () => void;
}

export const useEditorStore = create<EditorState>()(
    persist(
        (set) => ({
            uiScale: 1.0,
            isMuted: false,
            windowState: null,
            playTrigger: 0,
            stopTrigger: 0,

            setUiScale: (scale) => set({ uiScale: scale }),
            toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
            setWindowState: (ws) => set({ windowState: ws }),
            triggerPlay: () => set((state) => ({ playTrigger: state.playTrigger + 1 })),
            triggerStop: () => set((state) => ({ stopTrigger: state.stopTrigger + 1 })),
        }),
        {
            name: 'zerith-editor-prefs',
            partialize: (state) => ({
                uiScale: state.uiScale,
                isMuted: state.isMuted,
                windowState: state.windowState
            }),
        }
    )
);
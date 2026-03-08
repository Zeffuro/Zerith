import type { EditorSet, PlaybackQuickCommandsSlice } from '../types';
import type { NonMacroEditorCommandType } from '../../../plugins/types';

const DEFAULT_QUICK: NonMacroEditorCommandType[] = [
    'dialogue',
    'background',
    'sprite',
    'choice',
    'if',
    'while',
    'for',
    'jump',
    'call',
    'bgm',
];

export function createPlaybackQuickCommandsSlice(set: EditorSet): PlaybackQuickCommandsSlice {
    return {
        playTrigger: 0,
        stopTrigger: 0,
        playFromIndex: null,

        quickCommandTypes: DEFAULT_QUICK,

        setQuickCommandTypes: (types) =>
            set({ quickCommandTypes: Array.from(new Set(types.filter(Boolean))) }),

        toggleQuickCommandType: (type) =>
            set((state) => {
                const has = Array.isArray(state.quickCommandTypes)
                    && state.quickCommandTypes.includes(type);
                return {
                    quickCommandTypes: has
                        ? state.quickCommandTypes.filter((t: NonMacroEditorCommandType) => t !== type)
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
    };
}


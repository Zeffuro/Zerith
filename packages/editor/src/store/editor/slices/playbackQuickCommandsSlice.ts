import type { NonMacroEditorCommandType } from '../../../plugins/types';
import type { EditorSet, PlaybackQuickCommandsSlice } from '../types';

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
        moveQuickCommandType: (type, direction) =>
            set((state) => {
                const list = [...state.quickCommandTypes];
                const index = list.indexOf(type);
                if (index === -1) return {};
                const nextIndex = direction === 'left' ? index - 1 : index + 1;
                if (nextIndex < 0 || nextIndex >= list.length) return {};
                [list[index], list[nextIndex]] = [list[nextIndex], list[index]];
                return { quickCommandTypes: list };
            }),
        playFromIndex: undefined,
        playTrigger: 0,

        quickCommandTypes: DEFAULT_QUICK,

        setQuickCommandTypes: (types) =>
            set({ quickCommandTypes: [...new Set(types.filter(Boolean))] }),

        stopTrigger: 0,

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

        triggerPlay: () =>
            set((state) => ({
                playFromIndex: undefined,
                playTrigger: state.playTrigger + 1,
            })),

        triggerPlayFrom: (index) =>
            set((state) => ({
                playFromIndex: index,
                playTrigger: state.playTrigger + 1,
            })),

        triggerStop: () => set((state) => ({ stopTrigger: state.stopTrigger + 1 })),
    };
}


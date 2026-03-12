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
        activeExecutionPath: undefined,
        breakpoints: {},
        clearActiveExecutionPath: () => set({ activeExecutionPath: undefined }),
        isPlaybackPaused: false,
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
        pauseTrigger: 0,
        playFromIndex: undefined,
        playTrigger: 0,

        quickCommandTypes: DEFAULT_QUICK,

        resumeTrigger: 0,

        setActiveExecutionPath: (path) => set({ activeExecutionPath: path }),

        setPlaybackPaused: (paused) => set({ isPlaybackPaused: paused }),

        setQuickCommandTypes: (types) =>
            set({ quickCommandTypes: [...new Set(types.filter(Boolean))] }),

        stepTrigger: 0,

        stopTrigger: 0,

        toggleBreakpoint: (filePath, index) =>
            set((state) => {
                const current = state.breakpoints[filePath] ?? [];
                const has = current.includes(index);
                const nextValues = has
                    ? current.filter((value) => value !== index)
                    : [...current, index].toSorted((a, b) => a - b);
                return {
                    breakpoints: {
                        ...state.breakpoints,
                        [filePath]: nextValues,
                    },
                };
            }),

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

        triggerPause: () =>
            set((state) => ({
                pauseTrigger: state.pauseTrigger + 1,
            })),

        triggerPlay: () =>
            set((state) => ({
                activeExecutionPath: undefined,
                isPlaybackPaused: false,
                playFromIndex: undefined,
                playTrigger: state.playTrigger + 1,
            })),

        triggerPlayFrom: (index) =>
            set((state) => ({
                activeExecutionPath: undefined,
                isPlaybackPaused: false,
                playFromIndex: index,
                playTrigger: state.playTrigger + 1,
            })),

        triggerResume: () =>
            set((state) => ({
                resumeTrigger: state.resumeTrigger + 1,
            })),

        triggerStep: () =>
            set((state) => ({
                stepTrigger: state.stepTrigger + 1,
            })),

        triggerStop: () =>
            set((state) => ({
                activeExecutionPath: undefined,
                isPlaybackPaused: false,
                stopTrigger: state.stopTrigger + 1,
            })),
    };
}


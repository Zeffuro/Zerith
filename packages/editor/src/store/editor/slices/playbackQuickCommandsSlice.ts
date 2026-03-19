import type { NonMacroEditorCommandType } from '../../../plugins/types';
import type { EditorSet, PlaybackQuickCommandsSlice } from '../types';

import { DEFAULT_QUICK_COMMAND_TYPES } from '../../settings/SettingsSchema';
import { useSettingsStore } from '../../useSettingsStore';

export function createPlaybackQuickCommandsSlice(set: EditorSet): PlaybackQuickCommandsSlice {
    const settings = useSettingsStore.getState();
    const initialQuickCommandTypes = settings.quickCommandTypes.length > 0
        ? [...settings.quickCommandTypes]
        : [...DEFAULT_QUICK_COMMAND_TYPES];

    return {
        activeExecutionPath: undefined,
        breakpoints: {},
        clearActiveExecutionPath: () => set({ activeExecutionPath: undefined }),
        clearAllBreakpoints: () => set({ breakpoints: {} }),
        isPlaybackPaused: false,
        moveQuickCommandType: (type, direction) =>
            set((state) => {
                const list = [...state.quickCommandTypes];
                const index = list.indexOf(type);
                if (index === -1) return {};
                const nextIndex = direction === 'left' ? index - 1 : index + 1;
                if (nextIndex < 0 || nextIndex >= list.length) return {};
                [list[index], list[nextIndex]] = [list[nextIndex], list[index]];
                settings.setQuickCommandTypes(list);
                return { quickCommandTypes: list };
            }),
        pauseTrigger: 0,
        playFromIndex: undefined,
        playTrigger: 0,

        quickCommandTypes: initialQuickCommandTypes,

        resumeTrigger: 0,

        setActiveExecutionPath: (path) => set({ activeExecutionPath: path }),

        setPlaybackPaused: (paused) => set({ isPlaybackPaused: paused }),

        setQuickCommandTypes: (types) => {
            const nextQuickCommandTypes = [...new Set(types.filter(Boolean))];
            settings.setQuickCommandTypes(nextQuickCommandTypes);
            set({ quickCommandTypes: nextQuickCommandTypes });
        },

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
                const nextQuickCommandTypes = has
                    ? state.quickCommandTypes.filter((t: NonMacroEditorCommandType) => t !== type)
                    : [...state.quickCommandTypes, type];
                settings.setQuickCommandTypes(nextQuickCommandTypes);
                return {
                    quickCommandTypes: nextQuickCommandTypes,
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


import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
    defaultSettings,
    extractPersistedSettings,
    sanitizeAutosaveInterval,
    type SettingsState,
} from './settings/SettingsSchema';

type SettingsStore = {
    setAutosaveEnabled: (autosaveEnabled: boolean) => void;
    setAutosaveIntervalMs: (autosaveIntervalMs: number) => void;
    setIsMuted: (isMuted: boolean) => void;
    setKeymapOverrides: (keymapOverrides: SettingsState['keymapOverrides']) => void;
    setRecentProjects: (recentProjects: SettingsState['recentProjects']) => void;
    setThemeKey: (themeKey: string) => void;
    setUiScale: (uiScale: number) => void;
    setWindowState: (windowState: SettingsState['windowState']) => void;
} & SettingsState;

export const useSettingsStore = create<SettingsStore>()(
    persist(
        (set) => ({
            ...defaultSettings,
            setAutosaveEnabled: (autosaveEnabled) => set({ autosaveEnabled }),
            setAutosaveIntervalMs: (autosaveIntervalMs) => set({ autosaveIntervalMs: sanitizeAutosaveInterval(autosaveIntervalMs) }),
            setIsMuted: (isMuted) => set({ isMuted }),
            setKeymapOverrides: (keymapOverrides) => set({ keymapOverrides }),
            setRecentProjects: (recentProjects) => set({ recentProjects }),
            setThemeKey: (themeKey) => set({ themeKey }),
            setUiScale: (uiScale) => set({ uiScale }),
            setWindowState: (windowState) => set({ windowState }),
        }),
        {
            merge: (persisted: unknown, current) => {
                const persistedSettings = extractPersistedSettings(persisted);

                return {
                    ...current,
                    ...defaultSettings,
                    ...persistedSettings,
                };
            },
            name: 'zerith-settings',
            partialize: (state) => ({
                autosaveEnabled: state.autosaveEnabled,
                autosaveIntervalMs: state.autosaveIntervalMs,
                isMuted: state.isMuted,
                keymapOverrides: state.keymapOverrides,
                recentProjects: state.recentProjects,
                themeKey: state.themeKey,
                uiScale: state.uiScale,
                windowState: state.windowState,
            }),
        },
    ),
);


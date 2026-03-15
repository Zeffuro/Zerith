import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
    type CustomThemeEntry,
    defaultSettings,
    extractPersistedSettings,
    sanitizeAutosaveInterval,
    type SettingsState,
} from './settings/SettingsSchema';

type SettingsStore = {
    addCustomTheme: (theme: CustomThemeEntry) => void;
    deleteCustomTheme: (key: string) => void;
    setAutosaveEnabled: (autosaveEnabled: boolean) => void;
    setAutosaveIntervalMs: (autosaveIntervalMs: number) => void;
    setCustomThemes: (customThemes: SettingsState['customThemes']) => void;
    setIsMuted: (isMuted: boolean) => void;
    setKeymapOverrides: (keymapOverrides: SettingsState['keymapOverrides']) => void;
    setRecentProjects: (recentProjects: SettingsState['recentProjects']) => void;
    setThemeKey: (themeKey: string) => void;
    setUiScale: (uiScale: number) => void;
    setWindowState: (windowState: SettingsState['windowState']) => void;
    updateCustomTheme: (key: string, updates: Partial<Omit<CustomThemeEntry, 'key'>>) => void;
} & SettingsState;

export const useSettingsStore = create<SettingsStore>()(
    persist(
        (set) => ({
            ...defaultSettings,
            addCustomTheme: (theme) => set((state) => ({
                customThemes: [
                    ...state.customThemes.filter((existing) => existing.key !== theme.key),
                    theme,
                ],
            })),
            deleteCustomTheme: (key) => set((state) => {
                const customThemes = state.customThemes.filter((theme) => theme.key !== key);
                const themeKey = state.themeKey === key ? 'classic' : state.themeKey;
                return { customThemes, themeKey };
            }),
            setAutosaveEnabled: (autosaveEnabled) => set({ autosaveEnabled }),
            setAutosaveIntervalMs: (autosaveIntervalMs) => set({ autosaveIntervalMs: sanitizeAutosaveInterval(autosaveIntervalMs) }),
            setCustomThemes: (customThemes) => set({ customThemes }),
            setIsMuted: (isMuted) => set({ isMuted }),
            setKeymapOverrides: (keymapOverrides) => set({ keymapOverrides }),
            setRecentProjects: (recentProjects) => set({ recentProjects }),
            setThemeKey: (themeKey) => set({ themeKey }),
            setUiScale: (uiScale) => set({ uiScale }),
            setWindowState: (windowState) => set({ windowState }),
            updateCustomTheme: (key, updates) => set((state) => ({
                customThemes: state.customThemes.map((theme) => {
                    if (theme.key !== key) return theme;

                    return {
                        ...theme,
                        ...updates,
                        key,
                    };
                }),
            })),
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
                customThemes: state.customThemes,
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


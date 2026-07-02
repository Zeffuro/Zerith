import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
    type CustomThemeEntry,
    defaultSettings,
    type DockLayoutPreset,
    extractPersistedSettings,
    sanitizeAutosaveInterval,
    type SettingsState,
} from './settings/SettingsSchema';

type SettingsStore = {
    addCustomTheme: (theme: CustomThemeEntry) => void;
    deleteCustomTheme: (key: string) => void;
    deleteDockLayoutPreset: (id: string) => void;
    saveDockLayoutPreset: (name: string, layoutJson: unknown) => void;
    setActiveDockLayoutPresetId: (id: string | undefined) => void;
    setAudiosheetShortcutTargetMode: (mode: SettingsState['audiosheetShortcutTargetMode']) => void;
    setAutosaveEnabled: (autosaveEnabled: boolean) => void;
    setAutosaveIntervalMs: (autosaveIntervalMs: number) => void;
    setCheckForUpdatesOnStartup: (checkForUpdatesOnStartup: boolean) => void;
    setCodeEditorLargeText: (codeEditorLargeText: boolean) => void;
    setCodeEditorPlainTextComfort: (codeEditorPlainTextComfort: boolean) => void;
    setCodeEditorScreenReaderMode: (codeEditorScreenReaderMode: SettingsState['codeEditorScreenReaderMode']) => void;
    setCustomThemes: (customThemes: SettingsState['customThemes']) => void;
    setDockLayoutPresets: (dockLayoutPresets: SettingsState['dockLayoutPresets']) => void;
    setEditorScale: (editorScale: number | undefined) => void;
    setExplorerScale: (explorerScale: number | undefined) => void;
    setInspectorScale: (inspectorScale: number | undefined) => void;
    setIsMuted: (isMuted: boolean) => void;
    setKeymapOverrides: (keymapOverrides: SettingsState['keymapOverrides']) => void;
    setQuickCommandTypes: (quickCommandTypes: SettingsState['quickCommandTypes']) => void;
    setRecentProjects: (recentProjects: SettingsState['recentProjects']) => void;
    setThemeKey: (themeKey: string) => void;
    setTimelineScale: (timelineScale: number | undefined) => void;
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
            deleteDockLayoutPreset: (id) => set((state) => {
                const dockLayoutPresets = state.dockLayoutPresets.filter((preset) => preset.id !== id);
                const activeDockLayoutPresetId = state.activeDockLayoutPresetId === id ? undefined : state.activeDockLayoutPresetId;
                return {
                    activeDockLayoutPresetId,
                    dockLayoutPresets,
                };
            }),
            saveDockLayoutPreset: (name, layoutJson) => {
                const normalizedName = name.trim();
                if (normalizedName.length === 0) return;
                const now = Date.now();
                const result: DockLayoutPreset = {
                    id: `layout-${now}-${Math.random().toString(36).slice(2, 8)}`,
                    layoutJson,
                    name: normalizedName,
                    updatedAt: now,
                };

                set((state) => {
                    const existingPreset = state.dockLayoutPresets.find((preset) => preset.name.toLowerCase() === normalizedName.toLowerCase());
                    if (existingPreset) {
                        result.id = existingPreset.id;
                    }

                    const nextPreset: DockLayoutPreset = {
                        ...result,
                        id: existingPreset?.id ?? result.id,
                    };

                    return {
                        activeDockLayoutPresetId: nextPreset.id,
                        dockLayoutPresets: [
                            nextPreset,
                            ...state.dockLayoutPresets.filter((preset) => preset.id !== nextPreset.id),
                        ].toSorted((a, b) => b.updatedAt - a.updatedAt),
                    };
                });
            },
            setActiveDockLayoutPresetId: (activeDockLayoutPresetId) => set({ activeDockLayoutPresetId }),
            setAudiosheetShortcutTargetMode: (audiosheetShortcutTargetMode) => set({ audiosheetShortcutTargetMode }),
            setAutosaveEnabled: (autosaveEnabled) => set({ autosaveEnabled }),
            setAutosaveIntervalMs: (autosaveIntervalMs) => set({ autosaveIntervalMs: sanitizeAutosaveInterval(autosaveIntervalMs) }),
            setCheckForUpdatesOnStartup: (checkForUpdatesOnStartup) => set({ checkForUpdatesOnStartup }),
            setCodeEditorLargeText: (codeEditorLargeText) => set({ codeEditorLargeText }),
            setCodeEditorPlainTextComfort: (codeEditorPlainTextComfort) => set({ codeEditorPlainTextComfort }),
            setCodeEditorScreenReaderMode: (codeEditorScreenReaderMode) => set({ codeEditorScreenReaderMode }),
            setCustomThemes: (customThemes) => set({ customThemes }),
            setDockLayoutPresets: (dockLayoutPresets) => set({ dockLayoutPresets }),
            setEditorScale: (editorScale) => set({ editorScale }),
            setExplorerScale: (explorerScale) => set({ explorerScale }),
            setInspectorScale: (inspectorScale) => set({ inspectorScale }),
            setIsMuted: (isMuted) => set({ isMuted }),
            setKeymapOverrides: (keymapOverrides) => set({ keymapOverrides }),
            setQuickCommandTypes: (quickCommandTypes) => set({ quickCommandTypes: [...quickCommandTypes] }),
            setRecentProjects: (recentProjects) => set({ recentProjects }),
            setThemeKey: (themeKey) => set({ themeKey }),
            setTimelineScale: (timelineScale) => set({ timelineScale }),
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
                activeDockLayoutPresetId: state.activeDockLayoutPresetId,
                audiosheetShortcutTargetMode: state.audiosheetShortcutTargetMode,
                autosaveEnabled: state.autosaveEnabled,
                autosaveIntervalMs: state.autosaveIntervalMs,
                checkForUpdatesOnStartup: state.checkForUpdatesOnStartup,
                codeEditorLargeText: state.codeEditorLargeText,
                codeEditorPlainTextComfort: state.codeEditorPlainTextComfort,
                codeEditorScreenReaderMode: state.codeEditorScreenReaderMode,
                customThemes: state.customThemes,
                dockLayoutPresets: state.dockLayoutPresets,
                editorScale: state.editorScale,
                explorerScale: state.explorerScale,
                inspectorScale: state.inspectorScale,
                isMuted: state.isMuted,
                keymapOverrides: state.keymapOverrides,
                quickCommandTypes: state.quickCommandTypes,
                recentProjects: state.recentProjects,
                themeKey: state.themeKey,
                timelineScale: state.timelineScale,
                uiScale: state.uiScale,
                windowState: state.windowState,
            }),
        },
    ),
);


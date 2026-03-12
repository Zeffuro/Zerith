export const settingsBackedUiPrefsKeys = [
    'autosaveEnabled',
    'autosaveIntervalMs',
    'isMuted',
    'recentProjects',
    'themeKey',
    'uiScale',
    'windowState',
] as const;

export type SettingsBackedUiPrefKey = (typeof settingsBackedUiPrefsKeys)[number];

const settingsBackedUiPrefsKeySet = new Set<string>(settingsBackedUiPrefsKeys);

export function isSettingsBackedUiPrefKey(value: string): value is SettingsBackedUiPrefKey {
    return settingsBackedUiPrefsKeySet.has(value);
}


export type SettingsControlDefaults = SettingsControlSearchState;

export type SettingsControlId = 'audio' | 'autosaveEnabled' | 'autosaveIntervalMs' | 'theme' | 'uiScale';

export type SettingsControlSearchState = {
    autosaveEnabled: boolean;
    autosaveIntervalMs: number;
    isMuted: boolean;
    themeKey: string;
    uiScale: number;
};

export type SettingsPanelId =
    | 'appearance-scale'
    | 'appearance-theme'
    | 'appearance'
    | 'general-autosave'
    | 'general-playback'
    | 'general';

type SettingsControlDefinition = {
    badgePanelId: SettingsPanelId;
    changed: (state: SettingsControlSearchState, defaults: SettingsControlDefaults) => boolean;
    keywords: (state: SettingsControlSearchState) => string;
    panelIds: SettingsPanelId[];
};

const settingsControlRegistry: Record<SettingsControlId, SettingsControlDefinition> = {
    audio: {
        badgePanelId: 'general-playback',
        changed: (state, defaults) => state.isMuted !== defaults.isMuted,
        keywords: (state) => `audio ${state.isMuted ? 'muted off false' : 'unmuted on true'} playback sound`,
        panelIds: ['general', 'general-playback'],
    },
    autosaveEnabled: {
        badgePanelId: 'general-autosave',
        changed: (state, defaults) => state.autosaveEnabled !== defaults.autosaveEnabled,
        keywords: (state) => `autosave ${state.autosaveEnabled ? 'enabled on true' : 'disabled off false'} save`,
        panelIds: ['general', 'general-autosave'],
    },
    autosaveIntervalMs: {
        badgePanelId: 'general-autosave',
        changed: (state, defaults) => state.autosaveIntervalMs !== defaults.autosaveIntervalMs,
        keywords: (state) => `autosave interval ${Math.round(state.autosaveIntervalMs / 1000)} seconds save`,
        panelIds: ['general', 'general-autosave'],
    },
    theme: {
        badgePanelId: 'appearance-theme',
        changed: (state, defaults) => state.themeKey !== defaults.themeKey,
        keywords: (state) => `theme ${state.themeKey} classic classic soft appearance`,
        panelIds: ['general', 'appearance', 'appearance-theme'],
    },
    uiScale: {
        badgePanelId: 'appearance-scale',
        changed: (state, defaults) => state.uiScale !== defaults.uiScale,
        keywords: (state) => `ui scale ${Math.round(state.uiScale * 100)} percent zoom appearance`,
        panelIds: ['general', 'appearance', 'appearance-scale'],
    },
};

const settingsControlIds = Object.keys(settingsControlRegistry) as SettingsControlId[];

export function getVisibleSettingsControls(panelId: string): SettingsControlId[] {
    return settingsControlIds.filter((controlId) => settingsControlRegistry[controlId].panelIds.includes(panelId as SettingsPanelId));
}

export const getPanelSettingsControls = getVisibleSettingsControls;

export function getChangedSettingsControlIds(
    state: SettingsControlSearchState,
    defaults: SettingsControlDefaults,
): Set<SettingsControlId> {
    return new Set(
        settingsControlIds.filter((controlId) => settingsControlRegistry[controlId].changed(state, defaults)),
    );
}

export function getChangedSettingsLeafPanelCounts(
    state: SettingsControlSearchState,
    defaults: SettingsControlDefaults,
): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const controlId of settingsControlIds) {
        const definition = settingsControlRegistry[controlId];
        if (!definition.changed(state, defaults)) continue;

        const panelId = definition.badgePanelId;
        counts[panelId] = (counts[panelId] ?? 0) + 1;
    }

    return counts;
}

export function getMatchedSettingsControlIds(rawQuery: string, state: SettingsControlSearchState): Set<SettingsControlId> {
    const query = rawQuery.trim().toLowerCase();
    if (query.length === 0) return new Set(settingsControlIds);

    return new Set(
        settingsControlIds.filter((controlId) => {
            const keywords = settingsControlRegistry[controlId].keywords(state).toLowerCase();
            return keywords.includes(query);
        }),
    );
}

export function getMatchedSettingsPanelIds(rawQuery: string, state: SettingsControlSearchState): Set<string> {
    const matchedControlIds = getMatchedSettingsControlIds(rawQuery, state);
    const panelIds = new Set<string>();

    for (const controlId of matchedControlIds) {
        for (const panelId of settingsControlRegistry[controlId].panelIds) {
            panelIds.add(panelId);
        }
    }

    return panelIds;
}


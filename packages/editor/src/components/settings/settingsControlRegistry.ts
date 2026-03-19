import type { NonMacroEditorCommandType } from '../../plugins/types';
import type { CustomThemeEntry, DockLayoutPreset } from '../../store/settings/SettingsSchema';

export type SettingsControlDefaults = SettingsControlSearchState;

export type SettingsControlId =
    | 'audio'
    | 'audiosheetShortcutTargetMode'
    | 'autosaveEnabled'
    | 'autosaveIntervalMs'
    | 'customThemes'
    | 'dockLayoutPresets'
    | 'editorScale'
    | 'explorerScale'
    | 'inspectorScale'
    | 'quickCommandTypes'
    | 'theme'
    | 'timelineScale'
    | 'uiScale';

export type SettingsControlSearchState = {
    activeDockLayoutPresetId: string | undefined;
    audiosheetShortcutTargetMode: 'cursor' | 'playhead';
    autosaveEnabled: boolean;
    autosaveIntervalMs: number;
    customThemes: CustomThemeEntry[];
    dockLayoutPresets: DockLayoutPreset[];
    editorScale: number | undefined;
    explorerScale: number | undefined;
    inspectorScale: number | undefined;
    isMuted: boolean;
    quickCommandTypes: NonMacroEditorCommandType[];
    themeKey: string;
    timelineScale: number | undefined;
    uiScale: number;
};

export type SettingsPanelId =
    | 'appearance-scale'
    | 'appearance-theme'
    | 'appearance'
    | 'general-autosave'
    | 'general-layout'
    | 'general-playback'
    | 'general-quickbuttons'
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
    audiosheetShortcutTargetMode: {
        badgePanelId: 'general-playback',
        changed: (state, defaults) => state.audiosheetShortcutTargetMode !== defaults.audiosheetShortcutTargetMode,
        keywords: (state) => `audiosheet shortcut target ${state.audiosheetShortcutTargetMode} q e cue boundary playhead cursor`,
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
    customThemes: {
        badgePanelId: 'appearance-theme',
        changed: (state, defaults) => serializeCustomThemes(state.customThemes) !== serializeCustomThemes(defaults.customThemes),
        keywords: (state) => {
            const tokens = state.customThemes.flatMap((theme) => [theme.key, theme.label, theme.baseThemeKey ?? '']);
            return `custom themes create edit delete ${tokens.join(' ')}`;
        },
        panelIds: ['appearance', 'appearance-theme'],
    },
    dockLayoutPresets: {
        badgePanelId: 'general-layout',
        changed: (state, defaults) => serializeDockLayoutPresets(state.dockLayoutPresets) !== serializeDockLayoutPresets(defaults.dockLayoutPresets)
            || state.activeDockLayoutPresetId !== defaults.activeDockLayoutPresetId,
        keywords: (state) => {
            const presetNames = state.dockLayoutPresets.map((preset) => preset.name);
            return `layout dock panels preset save load reset ${presetNames.join(' ')}`;
        },
        panelIds: ['general', 'general-layout'],
    },
    editorScale: {
        badgePanelId: 'appearance-scale',
        changed: (state, defaults) => state.editorScale !== defaults.editorScale,
        keywords: (state) => {
            const current = state.editorScale ?? state.uiScale;
            const source = state.editorScale === undefined ? 'follow global inherited default' : 'override independent';
            return `editor scale surface ${source} ${Math.round(current * 100)} percent zoom appearance`;
        },
        panelIds: ['appearance', 'appearance-scale'],
    },
    explorerScale: {
        badgePanelId: 'appearance-scale',
        changed: (state, defaults) => state.explorerScale !== defaults.explorerScale,
        keywords: (state) => {
            const current = state.explorerScale ?? state.uiScale;
            const source = state.explorerScale === undefined ? 'follow global inherited default' : 'override independent';
            return `explorer scale ${source} ${Math.round(current * 100)} percent zoom appearance`;
        },
        panelIds: ['appearance', 'appearance-scale'],
    },
    inspectorScale: {
        badgePanelId: 'appearance-scale',
        changed: (state, defaults) => state.inspectorScale !== defaults.inspectorScale,
        keywords: (state) => {
            const current = state.inspectorScale ?? state.uiScale;
            const source = state.inspectorScale === undefined ? 'follow global inherited default' : 'override independent';
            return `inspector scale ${source} ${Math.round(current * 100)} percent zoom appearance`;
        },
        panelIds: ['appearance', 'appearance-scale'],
    },
    quickCommandTypes: {
        badgePanelId: 'general-quickbuttons',
        changed: (state, defaults) => serializeQuickCommandTypes(state.quickCommandTypes) !== serializeQuickCommandTypes(defaults.quickCommandTypes),
        keywords: (state) => `quick buttons commands toolbar timeline ${state.quickCommandTypes.join(' ')}`,
        panelIds: ['general', 'general-quickbuttons'],
    },
    theme: {
        badgePanelId: 'appearance-theme',
        changed: (state, defaults) => state.themeKey !== defaults.themeKey,
        keywords: (state) => `theme ${state.themeKey} classic classic soft appearance`,
        panelIds: ['general', 'appearance', 'appearance-theme'],
    },
    timelineScale: {
        badgePanelId: 'appearance-scale',
        changed: (state, defaults) => state.timelineScale !== defaults.timelineScale,
        keywords: (state) => {
            const current = state.timelineScale ?? state.uiScale;
            const source = state.timelineScale === undefined ? 'follow global inherited default' : 'override independent';
            return `timeline scale ${source} ${Math.round(current * 100)} percent zoom appearance`;
        },
        panelIds: ['appearance', 'appearance-scale'],
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

function serializeCustomThemes(customThemes: CustomThemeEntry[]): string {
    return JSON.stringify(
        customThemes
            .map((theme) => ({
                baseThemeKey: theme.baseThemeKey ?? '',
                key: theme.key,
                label: theme.label,
                vars: Object.entries(theme.vars).toSorted(([a], [b]) => a.localeCompare(b)),
            }))
            .toSorted((a, b) => a.key.localeCompare(b.key)),
    );
}

function serializeDockLayoutPresets(dockLayoutPresets: DockLayoutPreset[]): string {
    return JSON.stringify(
        dockLayoutPresets
            .map((preset) => ({
                id: preset.id,
                name: preset.name,
                updatedAt: preset.updatedAt,
            }))
            .toSorted((a, b) => a.id.localeCompare(b.id)),
    );
}

function serializeQuickCommandTypes(quickCommandTypes: NonMacroEditorCommandType[]): string {
    return quickCommandTypes.join('|');
}


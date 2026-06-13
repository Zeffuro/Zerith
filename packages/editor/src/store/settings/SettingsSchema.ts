import { BuiltInCommandTypes } from 'core/types';
import { z } from 'zod';

import type { NonMacroEditorCommandType } from '../../plugins/types';
import type { KeymapOverrides } from '../../services/keymapRegistry';
import type { EditorWindowState, RecentProject } from '../editor/types';

import { isGlobalShortcutCommand } from '../../services/keymapRegistry';
import { normalizeShortcutChord } from '../../services/shortcutChord';
import { isRecord } from '../../utils/typeGuards';

const MIN_AUTOSAVE_INTERVAL_MS = 5 * 1000;
const MAX_RECENT_PROJECTS = 12;
const MAX_DOCK_LAYOUT_PRESETS = 24;

export const DEFAULT_QUICK_COMMAND_TYPES: NonMacroEditorCommandType[] = [
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

export type CustomThemeEntry = {
    baseThemeKey?: string;
    key: string;
    label: string;
    vars: Record<string, string>;
};

export type DockLayoutPreset = {
    id: string;
    layoutJson: unknown;
    name: string;
    updatedAt: number;
};

function sanitizeAutosaveInterval(intervalMs: number): number {
    return Math.max(MIN_AUTOSAVE_INTERVAL_MS, Math.trunc(intervalMs));
}

function sanitizeCustomThemes(value: unknown): CustomThemeEntry[] | undefined {
    if (!Array.isArray(value)) return undefined;

    const themes: CustomThemeEntry[] = [];

    for (const entry of value) {
        if (!isRecord(entry)) continue;

        const key = typeof entry.key === 'string' ? entry.key.trim() : '';
        const label = typeof entry.label === 'string' ? entry.label.trim() : '';
        const variables = sanitizeCustomThemeVariables(entry.vars);

        if (key.length === 0 || label.length === 0 || !variables) continue;

        const baseThemeKey = typeof entry.baseThemeKey === 'string'
            ? entry.baseThemeKey.trim()
            : undefined;

        themes.push({
            baseThemeKey: baseThemeKey && baseThemeKey.length > 0 ? baseThemeKey : undefined,
            key,
            label,
            vars: variables,
        });
    }

    const uniqueByKey = new Map<string, CustomThemeEntry>();
    for (const theme of themes) uniqueByKey.set(theme.key, theme);

    return [...uniqueByKey.values()];
}

function sanitizeCustomThemeVariables(value: unknown): Record<string, string> | undefined {
    if (!isRecord(value)) return undefined;

    const variables: Record<string, string> = {};

    for (const [variableName, variableValue] of Object.entries(value)) {
        if (typeof variableValue !== 'string') continue;

        const normalizedName = variableName.trim();
        const normalizedValue = variableValue.trim();
        if (normalizedName.length === 0 || normalizedValue.length === 0) continue;
        variables[normalizedName] = normalizedValue;
    }

    return variables;
}

function sanitizeKeymapOverrides(value: unknown): KeymapOverrides | undefined {
    if (!isRecord(value)) return undefined;

    const overrides: KeymapOverrides = {};

    for (const [action, shortcutKey] of Object.entries(value)) {
        if (!isGlobalShortcutCommand(action) || typeof shortcutKey !== 'string') continue;

        const normalizedKey = normalizeShortcutChord(shortcutKey);
        if (!normalizedKey) continue;
        overrides[action] = normalizedKey;
    }

    return overrides;
}

const builtInCommandTypeSet = new Set<string>(BuiltInCommandTypes);

function isLikelyDockLayoutJson(value: unknown): boolean {
    if (!isRecord(value)) return false;
    return isRecord(value.global) && isRecord(value.layout);
}

function sanitizeDockLayoutPresets(value: unknown): DockLayoutPreset[] | undefined {
    if (!Array.isArray(value)) return undefined;

    const presets: DockLayoutPreset[] = [];

    for (const entry of value) {
        if (!isRecord(entry)) continue;

        const id = typeof entry.id === 'string' ? entry.id.trim() : '';
        const name = typeof entry.name === 'string' ? entry.name.trim() : '';
        const updatedAt = typeof entry.updatedAt === 'number' && Number.isFinite(entry.updatedAt)
            ? Math.trunc(entry.updatedAt)
            : undefined;
        const layoutJson = entry.layoutJson;

        if (id.length === 0 || name.length === 0 || updatedAt === undefined || !isLikelyDockLayoutJson(layoutJson)) continue;

        presets.push({
            id,
            layoutJson,
            name,
            updatedAt,
        });
    }

    const uniqueById = new Map<string, DockLayoutPreset>();
    for (const preset of presets) {
        const previous = uniqueById.get(preset.id);
        if (!previous || preset.updatedAt > previous.updatedAt) {
            uniqueById.set(preset.id, preset);
        }
    }

    return [...uniqueById.values()]
        .toSorted((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, MAX_DOCK_LAYOUT_PRESETS);
}

function sanitizeQuickCommandTypes(value: unknown): NonMacroEditorCommandType[] | undefined {
    if (!Array.isArray(value)) return undefined;

    const output: NonMacroEditorCommandType[] = [];
    for (const entry of value) {
        if (typeof entry !== 'string') continue;
        const trimmed = entry.trim();
        if (!builtInCommandTypeSet.has(trimmed)) continue;
        const commandType = trimmed;
        if (output.includes(commandType)) continue;
        output.push(commandType);
    }

    return output.length > 0 ? output : undefined;
}

function sanitizeRecentProjects(value: unknown): RecentProject[] | undefined {
    if (!Array.isArray(value)) return undefined;

    const projects: RecentProject[] = [];

    for (const entry of value) {
        if (!isRecord(entry)) continue;

        const path = typeof entry.path === 'string' ? entry.path.trim() : '';
        const name = typeof entry.name === 'string' ? entry.name.trim() : '';
        const lastOpened = typeof entry.lastOpened === 'number' && Number.isFinite(entry.lastOpened)
            ? Math.trunc(entry.lastOpened)
            : undefined;

        if (path.length === 0 || name.length === 0 || lastOpened === undefined) continue;
        projects.push({ lastOpened, name, path });
    }

    const uniqueByPath = new Map<string, RecentProject>();
    for (const project of projects) {
        const previous = uniqueByPath.get(project.path);
        if (!previous || project.lastOpened > previous.lastOpened) {
            uniqueByPath.set(project.path, project);
        }
    }

    return [...uniqueByPath.values()]
        .toSorted((a, b) => b.lastOpened - a.lastOpened)
        .slice(0, MAX_RECENT_PROJECTS);
}


const recentProjectsSchema = z.preprocess(
    (value) => sanitizeRecentProjects(value),
    z.array(z.object({
        lastOpened: z.number().finite(),
        name: z.string().min(1),
        path: z.string().min(1),
    })),
).optional();

const keymapOverridesSchema = z.preprocess(
    (value) => sanitizeKeymapOverrides(value),
    z.record(z.string(), z.string().min(1)),
).optional();

const customThemesSchema = z.preprocess(
    (value) => sanitizeCustomThemes(value),
    z.array(z.object({
        baseThemeKey: z.string().trim().min(1).optional(),
        key: z.string().trim().min(1),
        label: z.string().trim().min(1),
        vars: z.record(z.string(), z.string()),
    })),
).optional();

const dockLayoutPresetsSchema = z.preprocess(
    (value) => sanitizeDockLayoutPresets(value),
    z.array(z.object({
        id: z.string().trim().min(1),
        layoutJson: z.unknown(),
        name: z.string().trim().min(1),
        updatedAt: z.number().finite(),
    })),
).optional();

const quickCommandTypesSchema = z.preprocess(
    (value) => sanitizeQuickCommandTypes(value),
    z.array(z.enum(BuiltInCommandTypes)),
).optional();

const persistedSettingsSchema = z.object({
    activeDockLayoutPresetId: z.string().trim().min(1).optional(),
    audiosheetShortcutTargetMode: z.enum(['cursor', 'playhead']).optional(),
    autosaveEnabled: z.boolean().optional(),
    autosaveIntervalMs: z.number().finite().positive().transform(sanitizeAutosaveInterval).optional(),
    customThemes: customThemesSchema,
    dockLayoutPresets: dockLayoutPresetsSchema,
    editorScale: z.number().finite().positive().optional(),
    explorerScale: z.number().finite().positive().optional(),
    inspectorScale: z.number().finite().positive().optional(),
    isMuted: z.boolean().optional(),
    keymapOverrides: keymapOverridesSchema,
    quickCommandTypes: quickCommandTypesSchema,
    recentProjects: recentProjectsSchema,
    themeKey: z.string().trim().min(1).optional(),
    timelineScale: z.number().finite().positive().optional(),
    uiScale: z.number().finite().positive().optional(),
    windowState: z.object({
        height: z.number().finite().min(320),
        maximized: z.boolean(),
        width: z.number().finite().min(420),
        x: z.number().finite(),
        y: z.number().finite(),
    }).optional(),
});

export const SettingsSchema = persistedSettingsSchema;

export type PersistedSettings = z.output<typeof SettingsSchema>;

export type SettingsState = {
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
    keymapOverrides: KeymapOverrides;
    quickCommandTypes: NonMacroEditorCommandType[];
    recentProjects: RecentProject[];
    themeKey: string;
    timelineScale: number | undefined;
    uiScale: number;
    windowState: EditorWindowState;
};

export const defaultSettings: SettingsState = {
    activeDockLayoutPresetId: undefined,
    audiosheetShortcutTargetMode: 'cursor',
    autosaveEnabled: false,
    autosaveIntervalMs: 30 * 1000,
    customThemes: [],
    dockLayoutPresets: [],
    editorScale: undefined,
    explorerScale: undefined,
    inspectorScale: undefined,
    isMuted: false,
    keymapOverrides: {},
    quickCommandTypes: DEFAULT_QUICK_COMMAND_TYPES,
    recentProjects: [],
    themeKey: 'classic',
    timelineScale: undefined,
    uiScale: 1,
    windowState: undefined,
};

export function extractPersistedSettings(value: unknown): PersistedSettings {
    const result = persistedSettingsSchema.safeParse(value);
    return result.success ? result.data : {};
}

export { MAX_RECENT_PROJECTS, MIN_AUTOSAVE_INTERVAL_MS, sanitizeAutosaveInterval, sanitizeQuickCommandTypes };



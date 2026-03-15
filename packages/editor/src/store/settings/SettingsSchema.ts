import { z } from 'zod';

import type { KeymapOverrides } from '../../services/keymapRegistry';
import type { EditorWindowState, RecentProject } from '../editor/types';

import { isGlobalShortcutCommand } from '../../services/keymapRegistry';
import { normalizeShortcutChord } from '../../services/shortcutChord';
import { isRecord } from '../../utils/typeGuards';

const MIN_AUTOSAVE_INTERVAL_MS = 5 * 1000;
const MAX_RECENT_PROJECTS = 12;

export type CustomThemeEntry = {
    baseThemeKey?: string;
    key: string;
    label: string;
    vars: Record<string, string>;
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

const persistedSettingsSchema = z.object({
    autosaveEnabled: z.boolean().optional(),
    autosaveIntervalMs: z.number().finite().positive().transform(sanitizeAutosaveInterval).optional(),
    customThemes: customThemesSchema,
    isMuted: z.boolean().optional(),
    keymapOverrides: keymapOverridesSchema,
    recentProjects: recentProjectsSchema,
    themeKey: z.string().trim().min(1).optional(),
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
    autosaveEnabled: boolean;
    autosaveIntervalMs: number;
    customThemes: CustomThemeEntry[];
    isMuted: boolean;
    keymapOverrides: KeymapOverrides;
    recentProjects: RecentProject[];
    themeKey: string;
    uiScale: number;
    windowState: EditorWindowState;
};

export const defaultSettings: SettingsState = {
    autosaveEnabled: false,
    autosaveIntervalMs: 30 * 1000,
    customThemes: [],
    isMuted: false,
    keymapOverrides: {},
    recentProjects: [],
    themeKey: 'classic',
    uiScale: 1,
    windowState: undefined,
};

export function extractPersistedSettings(value: unknown): PersistedSettings {
    const result = persistedSettingsSchema.safeParse(value);
    return result.success ? result.data : {};
}

export { MAX_RECENT_PROJECTS, MIN_AUTOSAVE_INTERVAL_MS, sanitizeAutosaveInterval };



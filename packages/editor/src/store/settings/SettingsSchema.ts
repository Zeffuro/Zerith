import { z } from 'zod';

import type { EditorWindowState, RecentProject } from '../editor/types';

import { isRecord } from '../../utils/typeGuards';

const MIN_AUTOSAVE_INTERVAL_MS = 5 * 1000;
const MAX_RECENT_PROJECTS = 12;

function sanitizeAutosaveInterval(intervalMs: number): number {
    return Math.max(MIN_AUTOSAVE_INTERVAL_MS, Math.trunc(intervalMs));
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

const persistedSettingsSchema = z.object({
    autosaveEnabled: z.boolean().optional(),
    autosaveIntervalMs: z.number().finite().positive().transform(sanitizeAutosaveInterval).optional(),
    isMuted: z.boolean().optional(),
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
    isMuted: boolean;
    recentProjects: RecentProject[];
    themeKey: string;
    uiScale: number;
    windowState: EditorWindowState;
};

export const defaultSettings: SettingsState = {
    autosaveEnabled: false,
    autosaveIntervalMs: 30 * 1000,
    isMuted: false,
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



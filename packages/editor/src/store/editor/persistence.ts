import type { EditorState, EditorWindowState, RecentProject } from './types';

export type PersistedEditorState = Pick<
    EditorState,
    | 'autosaveEnabled'
    | 'autosaveIntervalMs'
    | 'breakpoints'
    | 'dockLayoutJson'
    | 'dockLayoutVersion'
    | 'isMuted'
    | 'quickCommandTypes'
    | 'recentProjects'
    | 'themeKey'
    | 'uiScale'
    | 'windowState'
>;

const persistedEditorStateKeys: (keyof PersistedEditorState)[] = [
    'autosaveEnabled',
    'autosaveIntervalMs',
    'breakpoints',
    'dockLayoutJson',
    'dockLayoutVersion',
    'isMuted',
    'quickCommandTypes',
    'recentProjects',
    'themeKey',
    'uiScale',
    'windowState',
];

export function extractPersistedEditorState(value: unknown): Partial<PersistedEditorState> {
    if (!isRecord(value)) return {};

    const extracted: Partial<PersistedEditorState> = {};
    for (const key of persistedEditorStateKeys) {
        if (key in value) {
            (extracted as Record<string, unknown>)[key] = value[key];
        }
    }

    const autosaveIntervalMs = sanitizeAutosaveInterval(extracted.autosaveIntervalMs);
    if (autosaveIntervalMs === undefined) {
        delete extracted.autosaveIntervalMs;
    } else {
        extracted.autosaveIntervalMs = autosaveIntervalMs;
    }

    const recentProjects = sanitizeRecentProjects(extracted.recentProjects);
    if (recentProjects === undefined) {
        delete extracted.recentProjects;
    } else {
        extracted.recentProjects = recentProjects;
    }

    const windowState = sanitizeWindowState(extracted.windowState);
    if (windowState === undefined) {
        delete extracted.windowState;
    } else {
        extracted.windowState = windowState;
    }

    return extracted;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object';
}

function sanitizeAutosaveInterval(value: unknown): number | undefined {
    const intervalMs = toFiniteNumber(value);
    if (intervalMs === undefined) return undefined;
    return Math.max(5 * 1000, Math.trunc(intervalMs));
}

function sanitizeRecentProjects(value: unknown): RecentProject[] | undefined {
    if (!Array.isArray(value)) return undefined;

    const projects: RecentProject[] = [];

    for (const entry of value) {
        if (!isRecord(entry)) continue;

        const path = typeof entry.path === 'string' ? entry.path.trim() : '';
        const name = typeof entry.name === 'string' ? entry.name.trim() : '';
        const lastOpened = toFiniteNumber(entry.lastOpened);

        if (path.length === 0 || name.length === 0 || lastOpened === undefined) continue;
        projects.push({ lastOpened: Math.trunc(lastOpened), name, path });
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
        .slice(0, 12);
}

function sanitizeWindowState(value: unknown): EditorWindowState {
    if (!isRecord(value)) return;

    const height = toFiniteNumber(value.height);
    const width = toFiniteNumber(value.width);
    const x = toFiniteNumber(value.x);
    const y = toFiniteNumber(value.y);
    const maximized = typeof value.maximized === 'boolean' ? value.maximized : false;

    if (height === undefined || width === undefined || x === undefined || y === undefined) return;
    if (height < 320 || width < 420) return;

    return { height, maximized, width, x, y };
}



function toFiniteNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}


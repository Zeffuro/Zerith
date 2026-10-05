import type { StoryMapFilter, StoryMapPosition } from './storyMapModel';

import { normalizePathForComparison } from '../../utils/pathComparison';
import { isRecord } from '../../utils/typeGuards';

export type StoryMapPreferences = { filter: StoryMapFilter; pan: StoryMapPosition; positions: Record<string, StoryMapPosition>; query: string; showMacros: boolean; zoom: number };
export const defaultStoryMapPreferences: StoryMapPreferences = { filter: 'all', pan: { x: 0, y: 0 }, positions: {}, query: '', showMacros: true, zoom: 1 };
const key = 'zerith-story-map-view-v1';

export function readStoryMapPreferences(projectPath: string, storage: Pick<Storage, 'getItem'> = localStorage): StoryMapPreferences {
    const raw = storage.getItem(key);
    const value: unknown = raw ? JSON.parse(raw) : {};
    if (!isRecord(value)) return defaultStoryMapPreferences;
    const entry = value[normalizePathForComparison(projectPath)];
    if (!isRecord(entry)) return defaultStoryMapPreferences;
    const positions = isRecord(entry.positions) ? Object.fromEntries(Object.entries(entry.positions).filter((pair): pair is [string, StoryMapPosition] => isPosition(pair[1])).slice(0, 5000)) : {};
    return {
        filter: entry.filter === 'missing' || entry.filter === 'unreachable' ? entry.filter : 'all',
        pan: isPosition(entry.pan) ? entry.pan : { x: 0, y: 0 },
        positions,
        query: typeof entry.query === 'string' ? entry.query.slice(0, 200) : '',
        showMacros: entry.showMacros !== false,
        zoom: typeof entry.zoom === 'number' && Number.isFinite(entry.zoom) ? Math.min(2, Math.max(.2, entry.zoom)) : 1,
    };
}

export function saveStoryMapPreferences(projectPath: string, preferences: StoryMapPreferences, storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage): void {
    const raw = storage.getItem(key);
    const value: unknown = raw ? JSON.parse(raw) : {};
    const previous = isRecord(value) ? value : {};
    const path = normalizePathForComparison(projectPath);
    const entries = Object.entries(previous).filter(([name]) => name !== path).slice(-11);
    const next = JSON.stringify(Object.fromEntries([...entries, [path, preferences]]));
    if (next.length > 1_000_000) throw new Error('Story map view is too large to remember.');
    storage.setItem(key, next);
}

function isPosition(value: unknown): value is StoryMapPosition {
    return isRecord(value) && typeof value.x === 'number' && typeof value.y === 'number' && Number.isFinite(value.x) && Number.isFinite(value.y) && Math.abs(value.x) < 1_000_000 && Math.abs(value.y) < 1_000_000;
}

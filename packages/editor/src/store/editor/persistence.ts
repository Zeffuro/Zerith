import type { EditorState, EditorWindowState } from './types';

export type PersistedEditorState = Pick<
    EditorState,
    'breakpoints' | 'dockLayoutJson' | 'dockLayoutVersion' | 'isMuted' | 'quickCommandTypes' | 'themeKey' | 'uiScale' | 'windowState'
>;

const persistedEditorStateKeys: (keyof PersistedEditorState)[] = [
    'breakpoints',
    'dockLayoutJson',
    'dockLayoutVersion',
    'isMuted',
    'quickCommandTypes',
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

    extracted.windowState = sanitizeWindowState(extracted.windowState);

    return extracted;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object';
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


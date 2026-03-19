import type { EditorState } from './types';

import { isRecord } from '../../utils/typeGuards';

export type PersistedEditorState = Pick<
    EditorState,
    | 'breakpoints'
    | 'dockLayoutJson'
    | 'dockLayoutVersion'
>;

export const persistedEditorStateKeys: (keyof PersistedEditorState)[] = [
    'breakpoints',
    'dockLayoutJson',
    'dockLayoutVersion',
];

export function extractPersistedEditorState(value: unknown): Partial<PersistedEditorState> {
    if (!isRecord(value)) return {};

    const extracted: Partial<PersistedEditorState> = {};
    for (const key of persistedEditorStateKeys) {
        if (key in value) {
            (extracted as Record<string, unknown>)[key] = value[key];
        }
    }

    return extracted;
}



import type { EditorState } from './types';

import { persistedEditorStateKeys } from './persistence';

export function partializeEditorStateForPersistence(state: EditorState) {
    return Object.fromEntries(
        persistedEditorStateKeys.map((key) => [key, state[key]]),
    ) as Pick<EditorState, (typeof persistedEditorStateKeys)[number]>;
}


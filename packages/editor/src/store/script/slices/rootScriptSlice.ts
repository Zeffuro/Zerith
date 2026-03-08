import type { ScriptSlice, ScriptState } from '../types';

import { normalizeScript } from '../helpers';

type RootScriptSlice = Pick<ScriptState, 'rootScript' | 'setScript'>;

export const createRootScriptSlice: ScriptSlice<RootScriptSlice> = (set) => ({
    rootScript: [],

    setScript: (script) =>
        set({
            future: [],
            past: [],
            rootScript: normalizeScript(script),
            scopePath: [],
            selectedNodeIndex: null,
            selectedNodePath: null,
        }),
});


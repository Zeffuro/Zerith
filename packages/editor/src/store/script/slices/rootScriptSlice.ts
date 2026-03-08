import { normalizeScript } from '../helpers';
import type { ScriptSlice, ScriptState } from '../types';

type RootScriptSlice = Pick<ScriptState, 'rootScript' | 'setScript'>;

export const createRootScriptSlice: ScriptSlice<RootScriptSlice> = (set) => ({
    rootScript: [],

    setScript: (script) =>
        set({
            rootScript: normalizeScript(script),
            scopePath: [],
            selectedNodeIndex: null,
            selectedNodePath: null,
            past: [],
            future: [],
        }),
});


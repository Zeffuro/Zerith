import type { Command } from 'zerith-core';

import { getAtPath, setAtPath } from '../../utils/scriptPathUtilities';
import { useProjectStore, useScriptStore } from '../storeBootstrap';

export interface ExecuteInspectorFieldPatchActionOptions {
    index?: null | number;
    patch: Record<string, unknown>;
}

export function executeInspectorFieldPatchAction(options: ExecuteInspectorFieldPatchActionOptions): void {
    const { index, patch } = options;

    const projectState = useProjectStore.getState();
    const scriptState = useScriptStore.getState();

    if (projectState.editingAllMacrosFile) {
        const { selectedNodePath } = scriptState;
        if (!selectedNodePath || selectedNodePath.length === 0) return;

        const macroIndex = selectedNodePath[0] as number;
        const macro = projectState.macroEntries[macroIndex];
        if (!macro) return;

        if (selectedNodePath.length === 1) {
            if (Array.isArray(patch.body)) {
                projectState.updateMacroCommands(macroIndex, patch.body as Command[]);
            }
            if (typeof patch.name === 'string' && patch.name !== macro.name) {
                projectState.renameMacroEntry(macroIndex, patch.name);
            }
            return;
        }

        const pathInsideMacro = selectedNodePath.slice(2);
        if (pathInsideMacro.length === 0) return;

        const currentCmd = getAtPath(macro.commands, pathInsideMacro) || {};
        const updatedCmd = { ...currentCmd, ...patch };
        const updatedCommands = setAtPath(macro.commands, pathInsideMacro, updatedCmd);

        if (Array.isArray(updatedCommands)) {
            projectState.updateMacroCommands(macroIndex, updatedCommands);
        }
        return;
    }

    if (index !== null && index !== undefined) {
        const script = scriptState.getActiveScript();
        const newScript = script.map((n, index_) => (index_ === index ? { ...n, ...patch } : n));
        scriptState.updateActiveScript(newScript);
        return;
    }

    if (scriptState.selectedNodePath) {
        scriptState.updateNodeAtPath(scriptState.selectedNodePath, patch);
    }
}



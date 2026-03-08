import type { Command } from 'core';

import type { MacroEntry } from '../useProjectStore';

import { useEditorStore } from '../useEditorStore';
import { useProjectStore } from '../useProjectStore';

export type ExecuteProjectOpenActionOptions =
    | { action: 'applyAssetSelection'; assetPath: string }
    | { action: 'applyMacrosFile'; entries: MacroEntry[]; path: string; }
    | { action: 'applyScriptFile'; path: string; script: Command[] };

export type ProjectOpenAction = 'applyAssetSelection' | 'applyMacrosFile' | 'applyScriptFile';

export function executeProjectOpenAction(options: ExecuteProjectOpenActionOptions): void {
    if (options.action === 'applyAssetSelection') {
        useEditorStore.getState().setSelectedAssetPath(options.assetPath);
        return;
    }

    const project = useProjectStore.getState();

    if (options.action === 'applyScriptFile') {
        project.setActiveFile(options.path, options.script);
        project.setActiveMacroName(null);
        project.setEditingAllMacrosFile(false);
        project.setMacroEntries([]);
        return;
    }

    project.setActiveMacroName(null);
    project.setEditingAllMacrosFile(true);
    project.setMacroEntries(options.entries);
    project.setActiveFile(options.path, []);
}


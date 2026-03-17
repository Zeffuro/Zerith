import type { Command } from 'core';

import type { MacroEntry } from '../project/types';

import { useProjectStore, useScriptStore } from '../storeBootstrap';
import { useEditorStore } from '../useEditorStore';
import { useWorkbenchStore } from '../useWorkbenchStore';

export type ExecuteProjectOpenActionOptions =
    | { action: 'applyAssetSelection'; assetPath: string }
    | { action: 'applyMacrosFile'; entries: MacroEntry[]; path: string; }
    | { action: 'applyScriptFile'; path: string; script: Command[] };


export function closeProject(): void {
    useWorkbenchStore.getState().clearTabs();
    useProjectStore.getState().setProject(undefined, []);
    useScriptStore.getState().setScript([]);
}

export function executeCloseProjectAction(): void {
    const dirtyCount = useProjectStore.getState().dirtyFiles.size;
    if (dirtyCount > 0) {
        useEditorStore.getState().requestProjectClose();
        return;
    }

    closeProject();
}

export function executeProjectOpenAction(options: ExecuteProjectOpenActionOptions): void {
    if (options.action === 'applyAssetSelection') {
        useEditorStore.getState().setSelectedAssetPath(options.assetPath);
        return;
    }

    const project = useProjectStore.getState();

    if (options.action === 'applyScriptFile') {
        project.setActiveFile(options.path, options.script);
        project.setActiveMacroName(undefined);
        project.setEditingAllMacrosFile(false);
        project.setMacroEntries([]);
        return;
    }

    project.setActiveMacroName(undefined);
    project.setEditingAllMacrosFile(true);
    project.setMacroEntries(options.entries);
    project.setActiveFile(options.path, []);
}



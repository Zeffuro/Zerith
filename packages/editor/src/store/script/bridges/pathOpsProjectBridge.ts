import type { ProjectState } from '../../project/types';

export type PathOpsProjectBridge = Pick<
    ProjectState,
    'editingAllMacrosFile' | 'macroEntries' | 'moveMacroEntries' | 'updateMacroCommands'
>;

let bridgeGetter: (() => PathOpsProjectBridge) | null = null;

export function setPathOpsProjectBridge(getter: () => PathOpsProjectBridge): void {
    bridgeGetter = getter;
}

export function getPathOpsProjectBridge(): PathOpsProjectBridge | null {
    return bridgeGetter ? bridgeGetter() : null;
}


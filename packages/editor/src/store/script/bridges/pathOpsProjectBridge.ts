import type { ProjectState } from '../../project/types';

export type PathOpsProjectBridge = Pick<
    ProjectState,
    'editingAllMacrosFile' | 'macroEntries' | 'moveMacroEntries' | 'updateMacroCommands'
>;

let bridgeGetter: (() => PathOpsProjectBridge) | undefined;

export function getPathOpsProjectBridge(): PathOpsProjectBridge | undefined {
    return bridgeGetter ? bridgeGetter() : undefined;
}

export function setPathOpsProjectBridge(getter: () => PathOpsProjectBridge): void {
    bridgeGetter = getter;
}


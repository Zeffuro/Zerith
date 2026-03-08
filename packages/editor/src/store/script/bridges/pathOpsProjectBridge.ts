import type { ProjectState } from '../../project/types';

export type PathOpsProjectBridge = Pick<
    ProjectState,
    'editingAllMacrosFile' | 'macroEntries' | 'moveMacroEntries' | 'updateMacroCommands'
>;

let bridgeGetter: (() => PathOpsProjectBridge) | null = null;

export function getPathOpsProjectBridge(): null | PathOpsProjectBridge {
    return bridgeGetter ? bridgeGetter() : null;
}

export function setPathOpsProjectBridge(getter: () => PathOpsProjectBridge): void {
    bridgeGetter = getter;
}


import type { ProjectState } from '../../project/types';

export type PathOpsProjectBridge = Pick<
    ProjectState,
    'editingAllMacrosFile' | 'macroEntries' | 'moveMacroEntries' | 'updateMacroCommands'
>;

export type GetPathOpsProjectBridge = () => PathOpsProjectBridge | undefined;


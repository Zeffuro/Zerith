import type { ProjectState } from '../../project/types';

export type GetPathOpsProjectBridge = () => PathOpsProjectBridge | undefined;

export type PathOpsProjectBridge = Pick<
    ProjectState,
    'editingAllMacrosFile' | 'macroEntries' | 'moveMacroEntries' | 'updateMacroCommands'
>;


import type { GlobalSearchProjectData } from '../globalSearch';
import type { ReferenceScannerResult } from './types';

import { useProjectStore } from '../../store/storeBootstrap';
import { scanProjectScriptBranches } from './coordinator';
import { scanReferenceTree } from './treeScan';
export { scanCommandReferences } from './commandScan';
export { scanProjectScriptBranches } from './coordinator';
export { scanMacroReferences, scanSceneReferences } from './orchestration';
export { resolveFilePath, resolveScenePath } from './paths';
export { getCommandFieldHints, unwrapObjectSchema } from './schemaHints';
export { scanReferenceTree } from './treeScan';
export type {
    InferredVariableType,
    ReferenceLocation,
    ReferenceScannerResult,
    VariableReferenceStats,
} from './types';
export {
    extractTemplateVariables,
    mergeInferredType,
    pushVariableRead,
    pushVariableWrite,
} from './variables';

export function scanReferences(
    projectData: GlobalSearchProjectData = useProjectStore.getState(),
): ReferenceScannerResult {
    const result: ReferenceScannerResult = {
        assets: {},
        characters: {},
        variables: {},
    };

    scanProjectScriptBranches(projectData, result, scanReferenceTree);

    return result;
}


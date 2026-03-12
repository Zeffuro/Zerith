import type { ScriptPath } from '../utils/scriptPathUtilities';
import type { GlobalSearchProjectData } from './globalSearch/contracts';

import { useProjectStore } from '../store/useProjectStore';
import { scanProjectScriptBranches } from './referenceScanner/coordinator';
import { scanReferenceTree } from './referenceScanner/treeScan';

export type InferredVariableType = 'boolean' | 'mixed' | 'number' | 'string' | 'unknown';

export type ReferenceLocation = {
    commandType: string;
    filePath: string;
    path: ScriptPath;
    sceneName: string;
};

export type ReferenceScannerResult = {
    assets: Record<string, ReferenceLocation[]>;
    characters: Record<string, ReferenceLocation[]>;
    variables: Record<string, VariableReferenceStats>;
};

export type VariableReferenceStats = {
    inferredType: InferredVariableType;
    reads: ReferenceLocation[];
    writes: ReferenceLocation[];
};

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

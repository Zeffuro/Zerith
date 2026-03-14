import type { ScriptPath } from '../../utils/scriptPathUtilities';

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


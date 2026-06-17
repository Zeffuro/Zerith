import type { ScriptPath } from '../../utils/scriptPathUtilities';

export type AssetDependencyGraph = {
    missing: AssetUsageEntry[];
    unused: string[];
    used: AssetUsageEntry[];
};

export type AssetUsageEntry = {
    assetUrl: string;
    references: ReferenceLocation[];
};

export type InferredVariableType = 'boolean' | 'mixed' | 'number' | 'string' | 'unknown';

export type ReferenceLocation = {
    commandType: string;
    filePath: string;
    path: ScriptPath;
    sceneName: string;
};

export type ReferenceScannerResult = {
    assetFiles: Record<string, ReferenceLocation[]>;
    assets: Record<string, ReferenceLocation[]>;
    characters: Record<string, ReferenceLocation[]>;
    items: Record<string, ReferenceLocation[]>;
    variables: Record<string, VariableReferenceStats>;
};


export type VariableReferenceStats = {
    inferredType: InferredVariableType;
    reads: ReferenceLocation[];
    writes: ReferenceLocation[];
};


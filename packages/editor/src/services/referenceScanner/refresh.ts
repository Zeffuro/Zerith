import type { GlobalSearchProjectData } from '../globalSearch';
import type { ReferenceScannerResult } from './types';

import { useProjectStore } from '../../store/storeBootstrap';
import { useReferenceStore } from '../../store/useReferenceStore';
import { collectDataAssetReferences, listProjectAssetFiles } from './assets';
import { scanProjectScriptBranches } from './coordinator';
import { scanReferenceTree } from './treeScan';

export type ReferenceScannerStateDependencies = {
    collectDataAssetReferences: (projectData: GlobalSearchProjectData, result: ReferenceScannerResult) => Promise<void>;
    listProjectAssetFiles: (projectPath: string) => Promise<string[]>;
    scanReferences: (projectData: GlobalSearchProjectData) => ReferenceScannerResult;
};

export type ReferenceScannerStateSnapshot = {
    assetInventory: string[];
    result: ReferenceScannerResult;
};

const defaultReferenceScannerStateDependencies: ReferenceScannerStateDependencies = {
    collectDataAssetReferences,
    listProjectAssetFiles,
    scanReferences: scanProjectReferences,
};

export async function buildReferenceScannerState(
    projectData: GlobalSearchProjectData,
    dependencies: ReferenceScannerStateDependencies = defaultReferenceScannerStateDependencies,
): Promise<ReferenceScannerStateSnapshot> {
    if (!projectData.projectPath) {
        return {
            assetInventory: [],
            result: createEmptyReferenceScannerResult(),
        };
    }

    const result = dependencies.scanReferences(projectData);
    await dependencies.collectDataAssetReferences(projectData, result);
    const assetInventory = await dependencies.listProjectAssetFiles(projectData.projectPath);

    return {
        assetInventory,
        result,
    };
}

export async function refreshReferenceScannerState(): Promise<ReferenceScannerStateSnapshot> {
    const nextState = await buildReferenceScannerState(useProjectStore.getState());
    useReferenceStore.getState().setResult(nextState.result);
    useReferenceStore.getState().setAssetInventory(nextState.assetInventory);
    return nextState;
}

function createEmptyReferenceScannerResult(): ReferenceScannerResult {
    return {
        assetFiles: {},
        assets: {},
        characters: {},
        items: {},
        variables: {},
    };
}

function scanProjectReferences(projectData: GlobalSearchProjectData): ReferenceScannerResult {
    const result = createEmptyReferenceScannerResult();
    scanProjectScriptBranches(projectData, result, scanReferenceTree);
    return result;
}

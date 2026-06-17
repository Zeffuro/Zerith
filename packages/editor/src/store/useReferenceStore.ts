import { create } from 'zustand';

import type {
    AssetDependencyGraph,
    ReferenceScannerResult,
} from '../services/referenceScanner';

import { createAssetDependencyGraph, toProjectAssetUrl } from '../services/referenceScanner';

export type ReferenceStoreState = {
    assetInventory: string[];
    getAssetDependencyGraph: () => AssetDependencyGraph;
    getAssetReferenceCountForFilePath: (filePath: string, projectPath: string | undefined) => number;
    isAssetFileReferenced: (filePath: string, projectPath: string | undefined) => boolean;
    result: ReferenceScannerResult;
    setAssetInventory: (assetInventory: string[]) => void;
    setResult: (result: ReferenceScannerResult) => void;
};

const EMPTY_RESULT: ReferenceScannerResult = {
    assetFiles: {},
    assets: {},
    characters: {},
    items: {},
    variables: {},
};

export const useReferenceStore = create<ReferenceStoreState>((set, get) => ({
    assetInventory: [],
    getAssetDependencyGraph: () => {
        const { assetInventory, result } = get();
        return createAssetDependencyGraph(result.assetFiles, assetInventory);
    },
    getAssetReferenceCountForFilePath: (filePath, projectPath) => {
        const assetUrl = toProjectAssetUrl(filePath, projectPath);
        if (!assetUrl) return 0;

        const references = get().result.assetFiles[assetUrl];
        return references ? references.length : 0;
    },
    isAssetFileReferenced: (filePath, projectPath) => {
        return get().getAssetReferenceCountForFilePath(filePath, projectPath) > 0;
    },
    result: EMPTY_RESULT,
    setAssetInventory: (assetInventory) => set({ assetInventory }),
    setResult: (result) => set({ result }),
}));


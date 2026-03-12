import { create } from 'zustand';

import type { ReferenceScannerResult } from '../services/referenceScanner';

export type ReferenceStoreState = {
    result: ReferenceScannerResult;
    setResult: (result: ReferenceScannerResult) => void;
};

const EMPTY_RESULT: ReferenceScannerResult = {
    assets: {},
    characters: {},
    variables: {},
};

export const useReferenceStore = create<ReferenceStoreState>((set) => ({
    result: EMPTY_RESULT,
    setResult: (result) => set({ result }),
}));


import type { Engine } from '@zeffuro/zerith-core';

import { create } from 'zustand';

type EngineBridgeState = {
    engine: Engine | undefined;
    previewSourceFile: string | undefined;
    setEngine: (engine: Engine | undefined) => void;
    setPreviewSourceFile: (engine: Engine, path: string | undefined) => void;
};

export const useEngineBridgeStore = create<EngineBridgeState>((set) => ({
    engine: undefined,
    previewSourceFile: undefined,
    setEngine: (engine) => set({ engine, previewSourceFile: undefined }),
    setPreviewSourceFile: (engine, path) => set(state => state.engine === engine ? { previewSourceFile: path } : {}),
}));


import type { Engine } from 'core';

import { create } from 'zustand';

type EngineBridgeState = {
    engine: Engine | undefined;
    setEngine: (engine: Engine | undefined) => void;
};

export const useEngineBridgeStore = create<EngineBridgeState>((set) => ({
    engine: undefined,
    setEngine: (engine) => set({ engine }),
}));


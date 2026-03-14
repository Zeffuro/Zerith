import { vi } from 'vitest';

vi.mock('../plugins/commandPlugins', () => ({
    getPlugin: () => ({}),
}));

vi.mock('../store/storeBootstrap', () => ({
    useProjectStore: {
        getState: () => ({
            characters: {},
            items: {},
            macros: {},
            manifest: {},
            projectPath: undefined,
            scenes: {},
        }),
    },
}));


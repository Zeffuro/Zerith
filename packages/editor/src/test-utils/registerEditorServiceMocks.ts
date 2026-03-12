import { vi } from 'vitest';

vi.mock('../plugins/commandPlugins', () => ({
    getPlugin: () => ({}),
}));

vi.mock('../store/useProjectStore', () => ({
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


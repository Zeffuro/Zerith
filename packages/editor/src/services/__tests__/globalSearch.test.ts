import { describe, expect, it, vi } from 'vitest';

vi.mock('../../plugins/commandPlugins', () => ({
    getPlugin: () => ({}),
}));

vi.mock('../../store/useProjectStore', () => ({
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

import { type GlobalSearchProjectData, replaceProjectContent, searchProjectContent } from '../globalSearch';

const projectData: GlobalSearchProjectData = {
    characters: {
        hero: {
            displayName: 'Hero',
            name: 'hero',
        },
    },
    items: {
        badge: {
            description: 'hero item',
            name: 'Hero Badge',
        },
    },
    macros: {
        greet: [{ speaker: 'Guide', text: 'hello hero', type: 'dialogue' }],
    },
    manifest: {
        characters: 'data/characters.json',
        items: 'data/items.json',
        macros: 'data/macros.json',
        scenes: {
            intro: 'scripts/intro.json',
        },
    },
    projectPath: '/project',
    scenes: {
        intro: [{ speaker: 'Narrator', text: 'hero appears', type: 'dialogue' }],
    },
};

describe('globalSearch', () => {
    it('searchProjectContent finds matches across scene/macro/character/item sources', () => {
        const results = searchProjectContent('hero', projectData);
        const kinds = new Set(results.map((result) => result.kind));

        expect(results.length).toBeGreaterThan(0);
        expect(kinds.has('scene')).toBe(true);
        expect(kinds.has('macro')).toBe(true);
        expect(kinds.has('character')).toBe(true);
        expect(kinds.has('item')).toBe(true);
    });

    it('replaceProjectContent returns changed files for replaceable matches', () => {
        const matches = searchProjectContent('hero', projectData);
        const files = replaceProjectContent('hero', 'champion', matches, projectData);

        expect(files.length).toBeGreaterThan(0);
        expect(files.some((file) => file.filePath.endsWith('/scripts/intro.json'))).toBe(true);
        expect(files.some((file) => file.filePath.endsWith('/data/macros.json'))).toBe(true);

        const mergedContent = files.map((file) => file.content).join('\n');
        expect(mergedContent.includes('champion')).toBe(true);
    });
});


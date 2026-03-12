import type { GlobalSearchProjectData } from '../services/globalSearch/contracts';

export function createGlobalSearchProjectData(
    overrides: Partial<GlobalSearchProjectData> = {},
): GlobalSearchProjectData {
    return {
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
        ...overrides,
    };
}

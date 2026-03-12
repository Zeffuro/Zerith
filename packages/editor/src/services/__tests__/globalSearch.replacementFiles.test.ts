import { describe, expect, it } from 'vitest';

import { createGlobalSearchProjectData } from '../../test-utils/projectDataBuilder';
import { toReplacementFilePayload } from '../globalSearch/replacementFiles';

describe('globalSearch replacement file helpers', () => {
    it('builds payload for character manifest path', () => {
        const projectData = createGlobalSearchProjectData();

        const payload = toReplacementFilePayload(
            '/project/data/characters.json',
            { hero: { displayName: 'Champion', name: 'hero' } },
            projectData.items,
            projectData.macros,
            projectData.scenes,
            projectData,
        );

        expect(payload?.kind).toBe('character');
        expect(payload?.filePath).toBe('/project/data/characters.json');
        expect(payload?.content.includes('Champion')).toBe(true);
    });

    it('builds payload for scene manifest path', () => {
        const projectData = createGlobalSearchProjectData();

        const payload = toReplacementFilePayload(
            '/project/scripts/intro.json',
            projectData.characters,
            projectData.items,
            projectData.macros,
            {
                intro: [{ speaker: 'Narrator', text: 'champion appears', type: 'dialogue' }],
            },
            projectData,
        );

        expect(payload?.kind).toBe('scene');
        expect(payload?.content.includes('champion appears')).toBe(true);
    });

    it('returns undefined for unmatched file path', () => {
        const projectData = createGlobalSearchProjectData();

        const payload = toReplacementFilePayload(
            '/project/unknown/path.json',
            projectData.characters,
            projectData.items,
            projectData.macros,
            projectData.scenes,
            projectData,
        );

        expect(payload).toBeUndefined();
    });

    it('returns undefined when scene manifest entry is not a file path', () => {
        const projectData = createGlobalSearchProjectData({
            manifest: {
                characters: 'data/characters.json',
                items: 'data/items.json',
                macros: 'data/macros.json',
                scenes: {
                    intro: { inline: true },
                },
            },
        });

        const payload = toReplacementFilePayload(
            '/project/scripts/intro.json',
            projectData.characters,
            projectData.items,
            projectData.macros,
            projectData.scenes,
            projectData,
        );

        expect(payload).toBeUndefined();
    });
});


import { describe, expect, it } from 'vitest';

import { createGlobalSearchProjectData } from '../../test-utils/projectDataBuilder';
import { resolveReplacementTarget } from '../globalSearch/replacementTargetResolver';

describe('globalSearch replacement target resolver', () => {
    it('resolves character/item/macro manifest file paths', () => {
        const projectData = createGlobalSearchProjectData();

        expect(resolveReplacementTarget('/project/data/characters.json', projectData.scenes, projectData)).toEqual({
            kind: 'character',
        });
        expect(resolveReplacementTarget('/project/data/items.json', projectData.scenes, projectData)).toEqual({
            kind: 'item',
        });
        expect(resolveReplacementTarget('/project/data/macros.json', projectData.scenes, projectData)).toEqual({
            kind: 'macro',
        });
    });

    it('resolves scene file path to scene kind with name', () => {
        const projectData = createGlobalSearchProjectData();

        expect(resolveReplacementTarget('/project/scripts/intro.json', projectData.scenes, projectData)).toEqual({
            kind: 'scene',
            sceneName: 'intro',
        });
    });

    it('returns undefined when path does not map to known replacement source', () => {
        const projectData = createGlobalSearchProjectData();

        expect(resolveReplacementTarget('/project/unknown/path.json', projectData.scenes, projectData)).toBeUndefined();
    });

    it('returns undefined for inline scene manifest entries', () => {
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

        expect(resolveReplacementTarget('/project/scripts/intro.json', projectData.scenes, projectData)).toBeUndefined();
    });
});


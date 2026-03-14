import { describe, expect, it } from 'vitest';

import { createGlobalSearchProjectData } from '../../test-utils/projectDataBuilder';
import { deriveManifestFilePaths, deriveSceneFilePathMap } from '../globalSearch/manifestPaths';

describe('globalSearch manifest path helpers', () => {
    it('derives character/item/macro paths from manifest', () => {
        const projectData = createGlobalSearchProjectData();

        expect(deriveManifestFilePaths(projectData)).toEqual({
            charactersPath: '/project/data/characters.json',
            itemsPath: '/project/data/items.json',
            macrosPath: '/project/data/macros.json',
        });
    });

    it('falls back to game.json when manifest resource paths are missing', () => {
        const projectData = createGlobalSearchProjectData({
            manifest: {
                scenes: {
                    intro: 'scripts/intro.json',
                },
            },
        });

        expect(deriveManifestFilePaths(projectData)).toEqual({
            charactersPath: '/project/game.json',
            itemsPath: '/project/game.json',
            macrosPath: '/project/game.json',
        });
    });

    it('resolves rooted and relative scene file paths for known scene keys', () => {
        const projectData = createGlobalSearchProjectData({
            manifest: {
                characters: 'data/characters.json',
                items: 'data/items.json',
                macros: 'data/macros.json',
                scenes: {
                    inlineOnly: { inline: true },
                    intro: 'scripts/intro.json',
                    outro: '/scripts/outro.json',
                },
            },
            scenes: {
                intro: [{ speaker: 'Narrator', text: 'intro', type: 'dialogue' }],
                outro: [{ speaker: 'Narrator', text: 'outro', type: 'dialogue' }],
            },
        });

        expect(deriveSceneFilePathMap(projectData.scenes, projectData)).toEqual({
            intro: '/project/scripts/intro.json',
            outro: '/project/scripts/outro.json',
        });
    });
});


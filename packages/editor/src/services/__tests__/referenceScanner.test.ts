import { describe, expect, it } from 'vitest';

import '../../test-utils/registerEditorServiceMocks';
import { createGlobalSearchProjectData } from '../../test-utils/projectDataBuilder';
import { scanReferences } from '../referenceScanner';

describe('referenceScanner', () => {
    it('collects asset, character, and variable references across scenes and macros', () => {
        const projectData = createGlobalSearchProjectData({
            macros: {
                greet: [{ action: 'show', assetUrl: 'sprites/hero.png', id: 'hero', type: 'sprite' }],
            },
            scenes: {
                intro: [
                    { assetUrl: 'bg/courtroom.png', type: 'background' },
                    { speaker: 'Phoenix', text: 'Status: {caseFlag}', type: 'dialogue' },
                    { key: 'score', op: 'set', type: 'set', value: 1 },
                    { all: [{ key: 'lives' }, { source: 'score' }], key: 'score', type: 'if' },
                ],
            },
        });

        const result = scanReferences(projectData);

        expect(result.assets['bg/courtroom.png']).toHaveLength(1);
        expect(result.assets['bg/courtroom.png'][0]).toMatchObject({
            commandType: 'background',
            filePath: '/project/scripts/intro.json',
            sceneName: 'intro',
        });

        expect(result.assets['sprites/hero.png']).toHaveLength(1);
        expect(result.assets['sprites/hero.png'][0]).toMatchObject({
            commandType: 'sprite',
            filePath: '/project/data/macros.json',
            path: [0, 'body', 0],
            sceneName: 'macro:greet',
        });

        expect(result.characters.Phoenix).toHaveLength(1);

        expect(result.variables.score.writes).toHaveLength(1);
        expect(result.variables.score.inferredType).toBe('number');
        expect(result.variables.score.reads.length).toBeGreaterThanOrEqual(2);

        expect(result.variables.lives.reads).toHaveLength(1);
        expect(result.variables.caseFlag.reads).toHaveLength(1);
    });

    it('returns an empty reference set when project path is unavailable', () => {
        const result = scanReferences(createGlobalSearchProjectData({ projectPath: undefined }));

        expect(result).toEqual({
            assets: {},
            characters: {},
            variables: {},
        });
    });
});

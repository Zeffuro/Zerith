import { beforeEach, describe, expect, it } from 'vitest';

import {
    getCreateNewProjectMocks,
    resetCreateNewProjectMocks,
} from '../../test-utils/registerCreateNewProjectMocks';
import { createNewProject } from '../createNewProject';

const serviceMocks = getCreateNewProjectMocks();

function getWriteCall(index: number): [string, string] {
    const call = serviceMocks.fsWriteTextFile.mock.calls[index] as unknown;
    if (!Array.isArray(call) || typeof call[0] !== 'string' || typeof call[1] !== 'string') {
        throw new TypeError(`Missing write call at index ${index}.`);
    }
    return [call[0], call[1]];
}

describe('createNewProject', () => {
    beforeEach(() => {
        resetCreateNewProjectMocks();
    });

    it('scaffolds manifest, intro scene, and engine config files', async () => {
        const result = await createNewProject({
            author: 'Ada',
            directory: '/projects/case-one',
            name: 'Case One',
        });

        expect(result).toEqual({
            manifestPath: '/projects/case-one/game.json',
            projectPath: '/projects/case-one',
        });

        expect(serviceMocks.fsMkdir).toHaveBeenNthCalledWith(1, '/projects/case-one', true);
        expect(serviceMocks.fsMkdir).toHaveBeenNthCalledWith(2, '/projects/case-one/scenes', true);

        expect(serviceMocks.fsWriteTextFile).toHaveBeenCalledTimes(3);

        const [manifestPath, manifestText] = getWriteCall(0);
        expect(manifestPath).toBe('/projects/case-one/game.json');
        expect(JSON.parse(manifestText)).toEqual({
            $schema: 'zerith/manifest',
            author: 'Ada',
            scenes: {
                intro: '/scenes/intro.json',
            },
            startScene: 'intro',
            title: 'Case One',
        });

        const [introPath, introText] = getWriteCall(1);
        expect(introPath).toBe('/projects/case-one/scenes/intro.json');
        expect(JSON.parse(introText)).toEqual([]);

        const [enginePath, engineText] = getWriteCall(2);
        expect(enginePath).toBe('/projects/case-one/engine.config.json');
        expect(JSON.parse(engineText)).toEqual({
            $schema: 'zerith/engine-config',
            display: {
                height: 720,
                scaleMode: 'fit',
                width: 1280,
            },
            theme: {
                boxColor: 51,
                fontFamily: 'Comic',
                fontSize: 24,
            },
        });
    });

    it('omits author when not provided', async () => {
        await createNewProject({
            author: ' '.repeat(3),
            directory: '/projects/case-two',
            name: 'Case Two',
        });

        const [, manifestText] = getWriteCall(0);
        const manifest = JSON.parse(manifestText) as Record<string, unknown>;

        expect(manifest.author).toBeUndefined();
    });

    it('throws when required fields are blank', async () => {
        await expect(createNewProject({ author: '', directory: ' '.repeat(3), name: 'Case' }))
            .rejects
            .toThrow('Project directory is required.');

        await expect(createNewProject({ author: '', directory: '/projects/case', name: ' '.repeat(3) }))
            .rejects
            .toThrow('Project name is required.');
    });
});


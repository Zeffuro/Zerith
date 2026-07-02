import { beforeEach, describe, expect, it } from 'vitest';

import {
    getCreateNewProjectMocks,
    resetCreateNewProjectMocks,
} from '../../test-utils/registerCreateNewProjectMocks';
import { createNewProject, getNewProjectTemplate } from '../createNewProject';

const serviceMocks = getCreateNewProjectMocks();
const disabledDefaultBlipUrl = JSON.parse('null') as null;

function getWriteCall(index: number): [string, string] {
    const call = serviceMocks.fsWriteTextFile.mock.calls[index] as unknown;
    if (!Array.isArray(call) || typeof call[0] !== 'string' || typeof call[1] !== 'string') {
        throw new TypeError(`Missing write call at index ${index}.`);
    }
    return [call[0], call[1]];
}

function getWriteCallByPath(path: string): string {
    for (const call of serviceMocks.fsWriteTextFile.mock.calls) {
        const writeCall = call as unknown;
        if (
            Array.isArray(writeCall)
            && writeCall[0] === path
            && typeof writeCall[1] === 'string'
        ) {
            return writeCall[1];
        }
    }

    throw new TypeError(`Missing write call for ${path}.`);
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
            initialEntryPath: '/projects/case-one/scenes/intro.json',
            manifestPath: '/projects/case-one/game.json',
            onboardingChecks: getNewProjectTemplate('blank').onboardingChecks,
            projectPath: '/projects/case-one',
            templateId: 'blank',
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
            schemaVersion: 2,
            startScene: 'intro',
            title: 'Case One',
        });

        const [introPath, introText] = getWriteCall(1);
        expect(introPath).toBe('/projects/case-one/scenes/intro.json');
        expect(JSON.parse(introText)).toEqual({
            $schema: 'zerith/scene',
            commands: [],
            id: 'intro',
            localeNamespace: 'scene.intro',
            schemaVersion: 2,
        });

        const [enginePath, engineText] = getWriteCall(2);
        expect(enginePath).toBe('/projects/case-one/engine.config.json');
        expect(JSON.parse(engineText)).toEqual({
            $schema: 'zerith/engine-config',
            audio: {
                defaultBlipUrl: disabledDefaultBlipUrl,
            },
            display: {
                height: 720,
                scaleMode: 'fit',
                width: 1280,
            },
            schemaVersion: 2,
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

    it('scaffolds the classic VN starter template and patches manifest identity', async () => {
        const result = await createNewProject({
            author: 'Ada',
            directory: '/projects/starter',
            name: 'Moonlit Case',
            templateId: 'classic-vn',
        });

        expect(result).toEqual({
            initialEntryPath: '/projects/starter/scenes/intro.json',
            manifestPath: '/projects/starter/game.json',
            onboardingChecks: getNewProjectTemplate('classic-vn').onboardingChecks,
            projectPath: '/projects/starter',
            templateId: 'classic-vn',
        });

        expect(serviceMocks.fsWriteTextFile.mock.calls.length).toBeGreaterThan(10);
        expect(serviceMocks.fsMkdir).toHaveBeenCalledWith('/projects/starter/assets/bg', true);
        expect(serviceMocks.fsMkdir).toHaveBeenCalledWith('/projects/starter/assets/items', true);
        expect(serviceMocks.fsMkdir).toHaveBeenCalledWith('/projects/starter/assets/sprites', true);
        expect(serviceMocks.fsMkdir).toHaveBeenCalledWith('/projects/starter/data', true);
        expect(serviceMocks.fsMkdir).toHaveBeenCalledWith('/projects/starter/locales', true);
        expect(serviceMocks.fsMkdir).toHaveBeenCalledWith('/projects/starter/scenes', true);

        const manifest = JSON.parse(getWriteCallByPath('/projects/starter/game.json')) as Record<string, unknown>;
        expect(manifest).toMatchObject({
            author: 'Ada',
            characters: '/data/characters.json',
            localization: {
                defaultLocale: 'en',
                locales: {
                    en: '/locales/en.json',
                },
            },
            startScene: 'intro',
            title: 'Moonlit Case',
        });

        const engineConfig = JSON.parse(getWriteCallByPath('/projects/starter/engine.config.json')) as Record<string, unknown>;
        expect(engineConfig).toMatchObject({
            audio: {
                defaultBlipUrl: disabledDefaultBlipUrl,
            },
        });

        expect(getWriteCallByPath('/projects/starter/scenes/intro.json')).toContain('"lineId"');
        expect(getWriteCallByPath('/projects/starter/locales/en.json')).toContain('intro.opening.001');
        expect(getWriteCallByPath('/projects/starter/assets/bg/studio-morning.svg')).toContain('<svg');
    });

    it('throws when required fields are blank', async () => {
        await expect(createNewProject({ author: '', directory: ' '.repeat(3), name: 'Case' }))
            .rejects
            .toThrow('Project directory is required.');

        await expect(createNewProject({ author: '', directory: '/projects/case', name: ' '.repeat(3) }))
            .rejects
            .toThrow('Project name is required.');
    });

    it('exposes template metadata for authoring onboarding', () => {
        const blank = getNewProjectTemplate('blank');
        const classic = getNewProjectTemplate('classic-vn');

        expect(blank).toMatchObject({
            category: 'utility',
            defaultName: 'My New Game',
            initialEntry: '/scenes/intro.json',
        });
        expect(classic).toMatchObject({
            category: 'starter',
            defaultName: 'Classic VN Starter',
            initialEntry: '/scenes/intro.json',
        });
        expect(classic.onboardingChecks.map((check) => check.id)).toEqual([
            'line-ids',
            'branching',
            'assets',
        ]);
    });

    it('throws for unknown templates', async () => {
        await expect(createNewProject({
            author: '',
            directory: '/projects/case',
            name: 'Case',
            templateId: 'unknown',
        }))
            .rejects
            .toThrow('Unknown project template: unknown');
    });
});


import { describe, expect, it, vi } from 'vitest';

import { createMissingJumpScene, resolveMissingJumpScenePlan } from '../timelineGraphSceneCreation';

describe('timelineGraphSceneCreation', () => {
    it('blocks creation when game.json has unsaved changes', () => {
        expect(resolveMissingJumpScenePlan({
            dirtyFiles: new Set(['/project/game.json']),
            manifest: { scenes: {} },
            projectPath: '/project',
            sceneName: 'missing-scene',
        })).toEqual({
            message: 'Save game.json before creating a jump target scene.',
            status: 'blocked',
        });
    });

    it('creates a missing jump scene beside the active scene and updates the manifest', async () => {
        const files = new Map<string, string>([
            ['/project/game.json', JSON.stringify({
                scenes: {
                    intro: 'scripts/intro.json',
                },
                schemaVersion: 2,
                startScene: 'intro',
            })],
        ]);
        const mkdir = vi.fn(() => Promise.resolve());
        const openProjectEntry = vi.fn(() => Promise.resolve());
        const reloadManifest = vi.fn(() => Promise.resolve());
        const writeTextFile = vi.fn((path: string, content: string) => {
            files.set(path, content);
            return Promise.resolve();
        });

        const result = await createMissingJumpScene({
            activeFile: '/project/scripts/intro.json',
            manifest: {
                scenes: {
                    intro: 'scripts/intro.json',
                },
                schemaVersion: 2,
            },
            projectPath: '/project',
            sceneName: 'missing-scene',
        }, {
            mkdir,
            openProjectEntry,
            readTextFile: (path) => {
                const value = files.get(path);
                if (value === undefined) throw new Error(`Missing file: ${path}`);
                return Promise.resolve(value);
            },
            reloadManifest,
            writeTextFile,
        });

        expect(result).toEqual({
            sceneName: 'missing-scene',
            scenePath: '/project/scripts/missing-scene.json',
            status: 'created',
        });
        expect(mkdir).toHaveBeenCalledWith('/project/scripts', true);

        const scene = JSON.parse(files.get('/project/scripts/missing-scene.json') ?? 'null') as Record<string, unknown>;
        expect(scene).toMatchObject({
            $schema: 'zerith/scene',
            localeNamespace: 'missing-scene',
            schemaVersion: 2,
        });
        expect(scene.commands).toMatchObject([
            { name: 'start', type: 'label' },
            {
                lineId: 'missing-scene.001',
                speaker: 'Narrator',
                text: 'New scene.',
                type: 'dialogue',
            },
        ]);

        const manifest = JSON.parse(files.get('/project/game.json') ?? 'null') as Record<string, unknown>;
        expect(manifest).toMatchObject({
            scenes: {
                intro: 'scripts/intro.json',
                'missing-scene': 'scripts/missing-scene.json',
            },
        });
        expect(reloadManifest).toHaveBeenCalledTimes(1);
        expect(openProjectEntry).toHaveBeenCalledWith(
            '/project/scripts/missing-scene.json',
            'missing-scene.json',
            { forceView: 'timeline' },
        );
    });

    it('does not overwrite an existing scene file', async () => {
        const result = await createMissingJumpScene({
            activeFile: '/project/scripts/intro.json',
            manifest: { scenes: { intro: 'scripts/intro.json' } },
            projectPath: '/project',
            sceneName: 'missing-scene',
        }, {
            readTextFile: (path) => Promise.resolve(path.endsWith('missing-scene.json')
                ? 'already here'
                : '{"scenes":{}}'),
        });

        expect(result).toEqual({
            message: 'Scene file already exists: /project/scripts/missing-scene.json',
            status: 'blocked',
        });
    });
});

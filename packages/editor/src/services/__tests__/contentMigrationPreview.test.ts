import { describe, expect, it } from 'vitest';

import { applyContentMigrationPreview, previewContentMigration, runContentMigration } from '../contentMigrationPreview';

describe('contentMigrationPreview', () => {
    it('previews manifest and external scene migrations without writing files', async () => {
        const files = new Map<string, string>([
            ['/project/game.json', JSON.stringify({
                scenes: {
                    intro: '/scenes/intro.json',
                },
                startScene: 'intro',
                title: 'Legacy',
            })],
            ['/project/scenes/intro.json', JSON.stringify([
                {
                    speaker: 'Juno',
                    text: 'Legacy line.',
                    type: 'dialogue',
                },
            ])],
        ]);

        const preview = await previewContentMigration('/project', {
            readTextFile: (path) => {
                const value = files.get(path);
                if (value === undefined) throw new Error(`Missing file: ${path}`);
                return Promise.resolve(value);
            },
        });

        expect(preview.manifestPath).toBe('/project/game.json');
        expect(preview.projectPath).toBe('/project');
        expect(preview.changes).toHaveLength(2);
        expect(preview.changes[0]).toMatchObject({
            path: '/project/game.json',
            type: 'manifest',
        });
        expect(JSON.parse(preview.changes[0]?.after ?? '{}')).toMatchObject({
            schemaVersion: 2,
        });
        expect(preview.changes[1]).toMatchObject({
            path: '/project/scenes/intro.json',
            sceneName: 'intro',
            type: 'scene',
        });
        expect(JSON.parse(preview.changes[1]?.after ?? '{}')).toMatchObject({
            $schema: 'zerith/scene',
            commands: [
                {
                    lineId: 'scene.intro.line.001',
                },
            ],
            id: 'intro',
            localeNamespace: 'scene.intro',
            schemaVersion: 2,
        });
    });

    it('previews inline scene migrations as a manifest change', async () => {
        const manifest = {
            scenes: {
                intro: [
                    {
                        speaker: 'Juno',
                        text: 'Inline legacy line.',
                        type: 'dialogue',
                    },
                ],
            },
            startScene: 'intro',
            title: 'Inline Legacy',
        };

        const preview = await previewContentMigration('/project/', {
            readTextFile: (path) => {
                expect(path).toBe('/project/game.json');
                return Promise.resolve(JSON.stringify(manifest));
            },
        });

        expect(preview.changes).toHaveLength(1);
        expect(preview.changes[0]).toMatchObject({
            path: '/project/game.json',
            type: 'manifest',
        });
        expect(JSON.parse(preview.changes[0]?.after ?? '{}')).toMatchObject({
            scenes: {
                intro: {
                    $schema: 'zerith/scene',
                    commands: [
                        {
                            lineId: 'scene.intro.line.001',
                        },
                    ],
                    id: 'intro',
                    localeNamespace: 'scene.intro',
                    schemaVersion: 2,
                },
            },
            schemaVersion: 2,
        });
    });

    it('returns no changes for current content that only differs by formatting', async () => {
        const manifest = {
            scenes: {
                intro: '/scenes/intro.json',
            },
            schemaVersion: 2,
            startScene: 'intro',
            title: 'Current',
        };
        const scene = {
            $schema: 'zerith/scene',
            commands: [
                {
                    lineId: 'scene.intro.line.001',
                    speaker: 'Juno',
                    text: 'Current line.',
                    type: 'dialogue',
                },
            ],
            id: 'intro',
            localeNamespace: 'scene.intro',
            schemaVersion: 2,
        };
        const files = new Map<string, string>([
            ['/project/game.json', JSON.stringify(manifest)],
            ['/project/scenes/intro.json', JSON.stringify(scene)],
        ]);

        const preview = await previewContentMigration('/project', {
            readTextFile: (path) => {
                const value = files.get(path);
                if (value === undefined) throw new Error(`Missing file: ${path}`);
                return Promise.resolve(value);
            },
        });

        expect(preview.changes).toEqual([]);
    });

    it('rejects non-object manifests', async () => {
        await expect(previewContentMigration('/project', {
            readTextFile: () => Promise.resolve('[]'),
        })).rejects.toThrow('Expected /project/game.json to contain a JSON object.');
    });

    it('writes only accepted preview changes', async () => {
        const preview = {
            changes: [
                {
                    after: '{"schemaVersion":2}\n',
                    before: '{}',
                    path: '/project/game.json',
                    type: 'manifest' as const,
                },
                {
                    after: '{"commands":[]}\n',
                    before: '[]',
                    path: '/project/scenes/intro.json',
                    sceneName: 'intro',
                    type: 'scene' as const,
                },
            ],
            manifestPath: '/project/game.json',
            projectPath: '/project',
        };
        const files = new Map<string, string>([
            ['/project/game.json', '{}'],
            ['/project/scenes/intro.json', '[]'],
        ]);
        const writes: Array<[string, string]> = [];

        const result = await applyContentMigrationPreview(preview, {
            acceptedPaths: ['/project/scenes/intro.json'],
        }, {
            readTextFile: (path) => Promise.resolve(files.get(path) ?? ''),
            writeTextFile: (path, content) => {
                writes.push([path, content]);
                files.set(path, content);
                return Promise.resolve();
            },
        });

        expect(result.conflicts).toEqual([]);
        expect(result.skipped).toEqual([preview.changes[0]]);
        expect(result.written).toEqual([preview.changes[1]]);
        expect(writes).toEqual([
            ['/project/scenes/intro.json', '{"commands":[]}\n'],
        ]);
    });

    it('does not write files whose content changed after preview', async () => {
        const preview = {
            changes: [
                {
                    after: '{"schemaVersion":2}\n',
                    before: '{}',
                    path: '/project/game.json',
                    type: 'manifest' as const,
                },
            ],
            manifestPath: '/project/game.json',
            projectPath: '/project',
        };
        const writes: Array<[string, string]> = [];

        const result = await applyContentMigrationPreview(preview, undefined, {
            readTextFile: () => Promise.resolve('{"changed":true}'),
            writeTextFile: (path, content) => {
                writes.push([path, content]);
                return Promise.resolve();
            },
        });

        expect(result.conflicts).toEqual([preview.changes[0]]);
        expect(result.skipped).toEqual([]);
        expect(result.written).toEqual([]);
        expect(writes).toEqual([]);
    });

    it('runs in preview-only mode by default', async () => {
        const files = new Map<string, string>([
            ['/project/game.json', JSON.stringify({
                scenes: {
                    intro: '/scenes/intro.json',
                },
                startScene: 'intro',
                title: 'Legacy',
            })],
            ['/project/scenes/intro.json', JSON.stringify([])],
        ]);
        const writes: Array<[string, string]> = [];

        const result = await runContentMigration('/project', undefined, {
            readTextFile: (path) => Promise.resolve(files.get(path) ?? ''),
            writeTextFile: (path, content) => {
                writes.push([path, content]);
                return Promise.resolve();
            },
        });

        expect(result.status).toBe('preview');
        expect(result.application).toBeUndefined();
        expect(result.preview.changes).toHaveLength(2);
        expect(writes).toEqual([]);
    });

    it('runs preview and writes accepted changes in apply mode', async () => {
        const files = new Map<string, string>([
            ['/project/game.json', JSON.stringify({
                scenes: {
                    intro: '/scenes/intro.json',
                },
                startScene: 'intro',
                title: 'Legacy',
            })],
            ['/project/scenes/intro.json', JSON.stringify([])],
        ]);

        const result = await runContentMigration('/project', { apply: true }, {
            readTextFile: (path) => Promise.resolve(files.get(path) ?? ''),
            writeTextFile: (path, content) => {
                files.set(path, content);
                return Promise.resolve();
            },
        });

        expect(result.status).toBe('applied');
        expect(result.preview.changes).toHaveLength(2);
        expect(result.application?.conflicts).toEqual([]);
        expect(result.application?.skipped).toEqual([]);
        expect(result.application?.written).toHaveLength(2);
        expect(JSON.parse(files.get('/project/game.json') ?? '{}')).toMatchObject({
            schemaVersion: 2,
        });
        expect(JSON.parse(files.get('/project/scenes/intro.json') ?? '{}')).toMatchObject({
            $schema: 'zerith/scene',
            schemaVersion: 2,
        });
    });
});

import { describe, expect, it } from 'vitest';

import {
    CURRENT_CONTENT_SCHEMA_VERSION,
    LEGACY_CONTENT_SCHEMA_VERSION,
    migrateGameManifestToCurrent,
    migrateSceneFileToCurrent,
} from '../schemas';

describe('contentMigration', () => {
    it('migrates legacy scene arrays to v2 scene envelopes with deterministic IDs', () => {
        const source = [
            {
                speaker: 'Juno',
                text: 'We need stable lines.',
                type: 'dialogue',
            },
            {
                options: [
                    {
                        commands: [
                            {
                                speaker: 'Juno',
                                text: 'Nested lines count too.',
                                type: 'dialogue',
                            },
                        ],
                        label: 'Continue',
                    },
                ],
                type: 'choice',
            },
        ];

        const migrated = migrateSceneFileToCurrent(source, { sceneId: 'intro' });

        expect(migrated.changed).toBe(true);
        expect(migrated.fromSchemaVersion).toBe(LEGACY_CONTENT_SCHEMA_VERSION);
        expect(migrated.scene).toMatchObject({
            $schema: 'zerith/scene',
            id: 'intro',
            localeNamespace: 'scene.intro',
            schemaVersion: CURRENT_CONTENT_SCHEMA_VERSION,
        });
        expect(migrated.scene.commands[0]).toMatchObject({
            lineId: 'scene.intro.line.001',
        });
        expect(migrated.scene.commands[1]).toMatchObject({
            id: 'scene.intro.choice.002',
        });
        expect(migrated.scene.commands[1]?.options).toMatchObject([
            {
                commands: [
                    {
                        lineId: 'scene.intro.line.002.001.001',
                    },
                ],
                id: 'scene.intro.choice.002.option.001',
                labelId: 'scene.intro.choice.002.option.001.label',
            },
        ]);
    });

    it('preserves existing line and choice IDs by default', () => {
        const migrated = migrateSceneFileToCurrent([
            {
                lineId: 'custom.line',
                speaker: 'Juno',
                text: 'Already identified.',
                type: 'dialogue',
            },
            {
                id: 'custom.choice',
                options: [
                    {
                        id: 'custom.option',
                        label: 'Keep it',
                        labelId: 'custom.option.label',
                    },
                ],
                type: 'choice',
            },
        ], { sceneId: 'intro' });

        expect(migrated.scene.commands[0]).toMatchObject({ lineId: 'custom.line' });
        expect(migrated.scene.commands[1]).toMatchObject({ id: 'custom.choice' });
        expect(migrated.scene.commands[1]?.options).toMatchObject([{ id: 'custom.option', labelId: 'custom.option.label' }]);
    });

    it('can overwrite existing IDs for deterministic regeneration', () => {
        const migrated = migrateSceneFileToCurrent([
            {
                lineId: 'custom.line',
                speaker: 'Juno',
                text: 'Regenerate me.',
                type: 'dialogue',
            },
        ], { preserveExistingIds: false, sceneId: 'intro' });

        expect(migrated.scene.commands[0]).toMatchObject({
            lineId: 'scene.intro.line.001',
        });
    });

    it('keeps an already-current scene unchanged when all required metadata is present', () => {
        const scene = {
            $schema: 'zerith/scene',
            commands: [
                {
                    lineId: 'scene.intro.line.001',
                    speaker: 'Juno',
                    text: 'Current.',
                    type: 'dialogue',
                },
            ],
            id: 'intro',
            localeNamespace: 'scene.intro',
            schemaVersion: CURRENT_CONTENT_SCHEMA_VERSION,
        };

        const migrated = migrateSceneFileToCurrent(scene);

        expect(migrated.changed).toBe(false);
        expect(migrated.fromSchemaVersion).toBe(CURRENT_CONTENT_SCHEMA_VERSION);
        expect(migrated.scene).toEqual(scene);
    });

    it('adds schemaVersion to manifests without changing existing content', () => {
        const manifest = {
            scenes: {
                intro: '/scenes/intro.json',
            },
            startScene: 'intro',
            title: 'Legacy',
        };

        const migrated = migrateGameManifestToCurrent(manifest);

        expect(migrated.changed).toBe(true);
        expect(migrated.manifest).toEqual({
            ...manifest,
            schemaVersion: CURRENT_CONTENT_SCHEMA_VERSION,
        });
    });

    it('rejects invalid scene migration input', () => {
        expect(() => migrateSceneFileToCurrent({ id: 'broken' })).toThrow(
            'Scene migration expected a command array or scene object with a commands array.',
        );
    });
});

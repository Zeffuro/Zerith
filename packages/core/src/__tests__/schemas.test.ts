import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import {
    CURRENT_CONTENT_SCHEMA_VERSION,
    GameManifestSchema,
    LEGACY_CONTENT_SCHEMA_VERSION,
    parseSceneFile,
    SchemaRegistry,
    validateScript,
} from '../schemas';
import { waitCommand } from '../test-utils/scriptBuilders';

describe('schemas', () => {
    it('validateScript keeps valid commands and tolerates invalid ones', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const valid = waitCommand({ duration: 10 });
        const invalid = { type: 'wait' };
        const output = validateScript([valid, invalid]);

        expect(output).toHaveLength(2);
        expect(output[0]).toMatchObject(valid);
        expect(output[1]).toBe(invalid);
        expect(warn).toHaveBeenCalled();

        warn.mockRestore();
    });

    it('SchemaRegistry register/get exposes newly registered command schemas', () => {
        const customType = 'vitest_custom_command';
        const customSchema = z.object({
            payload: z.string(),
            type: z.literal(customType),
        });

        SchemaRegistry.register(customType, customSchema);

        expect(SchemaRegistry.get(customType)).toBe(customSchema);

        const commandSchema = SchemaRegistry.getCommandSchema();
        const parsedCustom = commandSchema.safeParse({ payload: 'ok', type: customType });
        const parsedUnknown = commandSchema.safeParse({ anyField: 1, type: 'unknown_runtime_type' });

        expect(parsedCustom.success).toBe(true);
        expect(parsedUnknown.success).toBe(true);
    });

    it('GameManifestSchema accepts project metadata fields', () => {
        const parsed = GameManifestSchema.parse({
            $schema: 'zerith/manifest',
            author: 'Ada Lovelace',
            description: 'A courtroom mystery.',
            license: 'MIT',
            scenes: {
                intro: '/scenes/intro.json',
            },
            schemaVersion: CURRENT_CONTENT_SCHEMA_VERSION,
            startScene: 'intro',
            title: 'Case One',
            version: '1.2.3',
        });

        expect(parsed.author).toBe('Ada Lovelace');
        expect(parsed.description).toBe('A courtroom mystery.');
        expect(parsed.license).toBe('MIT');
        expect(parsed.schemaVersion).toBe(CURRENT_CONTENT_SCHEMA_VERSION);
        expect(parsed.version).toBe('1.2.3');
    });

    it('GameManifestSchema accepts external descriptor file references', () => {
        const parsed = GameManifestSchema.parse({
            characters: '/data/characters.json',
            items: '/data/items.json',
            localization: {
                defaultLocale: 'en',
                locales: {
                    en: '/locales/en.json',
                },
            },
            macros: '/data/macros.json',
            scenes: {
                intro: '/scenes/intro.json',
            },
            schemaVersion: CURRENT_CONTENT_SCHEMA_VERSION,
            startScene: 'intro',
            title: 'Referenced Content',
        });

        expect(parsed.characters).toBe('/data/characters.json');
        expect(parsed.items).toBe('/data/items.json');
        expect(parsed.localization?.locales?.en).toBe('/locales/en.json');
        expect(parsed.macros).toBe('/data/macros.json');
    });

    it('GameManifestSchema remains backward compatible with missing metadata', () => {
        const parsed = GameManifestSchema.parse({
            scenes: {
                intro: '/scenes/intro.json',
            },
            startScene: 'intro',
            title: 'Legacy Game',
        });

        expect(parsed.author).toBeUndefined();
        expect(parsed.description).toBeUndefined();
        expect(parsed.license).toBeUndefined();
        expect(parsed.version).toBeUndefined();
    });

    it('GameManifestSchema accepts v2 inline scene envelopes', () => {
        const parsed = GameManifestSchema.parse({
            scenes: {
                intro: {
                    $schema: 'zerith/scene',
                    commands: [waitCommand({ duration: 1 })],
                    id: 'intro',
                    localeNamespace: 'scene.intro',
                    schemaVersion: CURRENT_CONTENT_SCHEMA_VERSION,
                },
            },
            schemaVersion: CURRENT_CONTENT_SCHEMA_VERSION,
        });

        const scene = parsed.scenes?.intro;

        expect(scene).toMatchObject({
            id: 'intro',
            localeNamespace: 'scene.intro',
            schemaVersion: CURRENT_CONTENT_SCHEMA_VERSION,
        });
    });

    it('parseSceneFile keeps legacy arrays and normalizes v2 scene envelopes', () => {
        const legacy = parseSceneFile([waitCommand({ duration: 5 })]);
        const versioned = parseSceneFile({
            $schema: 'zerith/scene',
            commands: [waitCommand({ duration: 10 })],
            id: 'intro',
            localeNamespace: 'scene.intro',
            schemaVersion: CURRENT_CONTENT_SCHEMA_VERSION,
        });

        expect(legacy.schemaVersion).toBe(LEGACY_CONTENT_SCHEMA_VERSION);
        expect(legacy.commands).toEqual([waitCommand({ duration: 5 })]);
        expect(versioned.schemaVersion).toBe(CURRENT_CONTENT_SCHEMA_VERSION);
        expect(versioned.metadata.id).toBe('intro');
        expect(versioned.commands).toEqual([waitCommand({ duration: 10 })]);
    });

    it('parseSceneFile rejects objects without a commands array', () => {
        expect(() => parseSceneFile({ id: 'broken' }, { sceneName: 'broken' }))
            .toThrow('Invalid scene "broken"');
    });

    it('dialogue and choice schemas accept optional VN production metadata', () => {
        const commandSchema = SchemaRegistry.getCommandSchema();

        const parsedDialogue = commandSchema.safeParse({
            backlogVisibility: 'show',
            expressionRef: 'juno.angry',
            lineId: 'intro.001',
            speaker: 'Juno',
            tags: ['intro', 'voiced'],
            text: 'This line is ready for localization and backlog tooling.',
            type: 'dialogue',
            voice: {
                assetUrl: '/assets/voice/intro.ogg',
                cue: 'intro.001',
            },
        });
        const parsedChoice = commandSchema.safeParse({
            id: 'intro.choice.ready',
            options: [
                {
                    analyticsLabel: 'Ready',
                    commands: [waitCommand({ duration: 1 })],
                    id: 'intro.choice.ready.yes',
                    label: 'Ready',
                    labelId: 'intro.choice.ready.yes.label',
                    replayable: true,
                },
            ],
            type: 'choice',
        });

        expect(parsedDialogue.success).toBe(true);
        expect(parsedChoice.success).toBe(true);
    });

    it('SpriteCommandSchema accepts ratio-based placement fields', () => {
        const parsed = SchemaRegistry.getCommandSchema().safeParse({
            action: 'show',
            fit: 'contain',
            heightRatio: 0.8,
            id: 'juno',
            type: 'sprite',
            widthRatio: 0.35,
            xRatio: 0.3,
            yRatio: 1,
        });

        expect(parsed.success).toBe(true);
    });
});

import { describe, expect, it } from 'vitest';

import type { CharacterDefinition, LocaleBundle, Script } from '../types';

import {
    collectCharacterAssetDependencies,
    collectCompiledContentCacheSources,
    collectItemAssetDependencies,
    compileContentManifest,
    extractScriptAssetDependencies,
} from '../utils/ContentCompiler';

describe('content compiler', () => {
    it('collects scene dependencies from nested commands and called macros', () => {
        const macros: Record<string, Script> = {
            setStage: [
                { assetUrl: '/assets/bg/stage.png', type: 'background' },
                { assetUrl: '/assets/sfx/ui.sheet.json:confirm', type: 'sfx' },
            ],
        };
        const dependencies = extractScriptAssetDependencies([
            { name: 'setStage', type: 'call' },
            {
                onTrue: [
                    { assetUrl: '/assets/bgm/theme.ogg', type: 'bgm' },
                    {
                        speaker: 'Ari',
                        text: 'Testing.',
                        type: 'dialogue',
                        voice: { assetUrl: '/assets/voice/ari.sheet.json', cue: 'line-001' },
                    },
                ],
                type: 'if',
            },
            {
                options: [
                    {
                        commands: [
                            { assetUrl: '/assets/bg/choice.png', type: 'scene_change' },
                        ],
                        label: 'Branch',
                    },
                ],
                type: 'choice',
            },
            { assetUrl: '/assets/sprites/ari.png', id: 'ari', type: 'sprite' },
            { assetUrl: 'party:smile', id: 'ari', type: 'sprite' },
        ], { macros });

        expect(dependencies).toEqual({
            audio: ['/assets/bgm/theme.ogg'],
            audiosheets: ['/assets/sfx/ui.sheet.json', '/assets/voice/ari.sheet.json'],
            spritesheets: [],
            textures: ['/assets/bg/choice.png', '/assets/bg/stage.png', '/assets/sprites/ari.png'],
        });
    });

    it('collects global character and item dependencies', () => {
        const characters: Record<string, CharacterDefinition> = {
            ari: {
                blipUrl: '/assets/sfx/blip.wav',
                displayName: 'Ari',
                name: 'ari',
                portraitUrl: '/assets/portraits/ari.png',
                spritesheet: { atlasUrl: '/assets/sprites/ari.sheet.json' },
            },
        };

        expect(collectCharacterAssetDependencies(characters)).toEqual({
            audio: ['/assets/sfx/blip.wav'],
            audiosheets: [],
            spritesheets: ['/assets/sprites/ari.sheet.json'],
            textures: ['/assets/portraits/ari.png'],
        });
        expect(collectItemAssetDependencies({
            badge: {
                description: 'A brass badge.',
                imageUrl: '/assets/items/badge.png',
                name: 'Badge',
            },
        })).toEqual({
            audio: [],
            audiosheets: [],
            spritesheets: [],
            textures: ['/assets/items/badge.png'],
        });
    });

    it('builds a deterministic compiled content manifest', () => {
        const locale: LocaleBundle = {
            locale: 'en',
            namespaces: {
                intro: {
                    'intro.line-001': 'Hello.',
                },
            },
        };

        const compiled = compileContentManifest({
            characters: {
                ari: {
                    displayName: 'Ari',
                    name: 'ari',
                    portraitUrl: '/assets/portraits/ari.png',
                },
            },
            items: {
                badge: {
                    description: 'A brass badge.',
                    imageUrl: '/assets/items/badge.png',
                    name: 'Badge',
                },
            },
            locales: { en: locale },
            macros: {
                stage: [{ assetUrl: '/assets/bg/stage.png', type: 'background' }],
            },
            manifest: {
                schemaVersion: 2,
                startScene: 'intro',
                title: 'Compiler Test',
                version: '1.0.0',
            },
            scenes: {
                ending: [],
                intro: {
                    commands: [
                        { name: 'stage', type: 'call' },
                        { assetUrl: '/assets/bgm/theme.ogg', type: 'bgm' },
                        { to: 'ending', type: 'jump' },
                    ],
                    localeNamespace: 'intro',
                    schemaVersion: 2,
                },
            },
        });

        expect(compiled).toEqual({
            $schema: 'zerith/compiled-content',
            assets: {
                all: {
                    audio: ['/assets/bgm/theme.ogg'],
                    audiosheets: [],
                    spritesheets: [],
                    textures: ['/assets/bg/stage.png', '/assets/items/badge.png', '/assets/portraits/ari.png'],
                },
                byScene: {
                    ending: {
                        audio: [],
                        audiosheets: [],
                        spritesheets: [],
                        textures: [],
                    },
                    intro: {
                        audio: ['/assets/bgm/theme.ogg'],
                        audiosheets: [],
                        spritesheets: [],
                        textures: ['/assets/bg/stage.png'],
                    },
                },
                global: {
                    audio: [],
                    audiosheets: [],
                    spritesheets: [],
                    textures: ['/assets/items/badge.png', '/assets/portraits/ari.png'],
                },
            },
            compilerVersion: 1,
            contentSchemaVersion: 2,
            locales: {
                en: {
                    entryCount: 1,
                    namespaces: ['intro'],
                },
            },
            scenes: {
                ending: {
                    commandCount: 0,
                    dependencies: {
                        audio: [],
                        audiosheets: [],
                        spritesheets: [],
                        textures: [],
                    },
                },
                intro: {
                    commandCount: 3,
                    dependencies: {
                        audio: ['/assets/bgm/theme.ogg'],
                        audiosheets: [],
                        spritesheets: [],
                        textures: ['/assets/bg/stage.png'],
                    },
                    localeNamespace: 'intro',
                    nextScenes: ['ending'],
                    schemaVersion: 2,
                },
            },
            source: {
                startScene: 'intro',
                title: 'Compiler Test',
                version: '1.0.0',
            },
        });
    });

    it('collects deterministic cache sources for local compiled content', () => {
        const compiled = compileContentManifest({
            characters: {
                ari: {
                    displayName: 'Ari',
                    name: 'ari',
                    portraitUrl: '/assets/portraits/ari.png',
                },
            },
            manifest: {
                characters: '/data/characters.json',
                localization: {
                    defaultLocale: 'en',
                    locales: {
                        en: '/locales/en.json',
                        remote: 'https://cdn.example.test/remote-locale.json',
                    },
                },
                scenes: {
                    intro: '/scenes/intro.json',
                    remote: 'https://cdn.example.test/scene.json',
                },
                startScene: 'intro',
            },
            scenes: {
                intro: [
                    { assetUrl: '/assets/bg/stage.png', type: 'background' },
                    { assetUrl: 'data:image/png;base64,abc', id: 'inline', type: 'sprite' },
                    { assetUrl: 'https://cdn.example.test/theme.ogg', type: 'bgm' },
                ],
            },
        });

        expect(collectCompiledContentCacheSources({
            characters: '/data/characters.json',
            localization: {
                defaultLocale: 'en',
                locales: {
                    en: '/locales/en.json',
                    remote: 'https://cdn.example.test/remote-locale.json',
                },
            },
            scenes: {
                intro: '/scenes/intro.json',
                remote: 'https://cdn.example.test/scene.json',
            },
            startScene: 'intro',
        }, compiled)).toEqual([
            { kind: 'asset', path: 'assets/bg/stage.png' },
            { kind: 'asset', path: 'assets/portraits/ari.png' },
            { kind: 'content', path: 'data/characters.json' },
            { kind: 'content', path: 'game.json' },
            { kind: 'content', path: 'locales/en.json' },
            { kind: 'content', path: 'scenes/intro.json' },
        ]);
    });
});

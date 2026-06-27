import { describe, expect, it, vi } from 'vitest';

import {
    applyAssetReferenceRewritePlan,
    formatAssetReferenceReplacement,
    getDirtyAssetReferenceFiles,
    prepareAssetReferenceRewritePlan,
    rewriteAssetReferencesInJson,
} from '../assetReferenceRewrite';

describe('assetReferenceRewrite', () => {
    it('rewrites command asset strings inside v2 scene files', () => {
        const scene = {
            commands: [
                { assetUrl: 'bg/office.png', type: 'background' },
                { action: 'play', assetUrl: '/assets/sfx/click.wav:tap', type: 'sfx' },
            ],
            metadata: { schemaVersion: 2 },
        };

        const count = rewriteAssetReferencesInJson(scene, {
            filePath: '/project/scenes/intro.json',
            newAssetUrl: '/assets/bg/office-night.png',
            oldAssetUrl: '/assets/bg/office.png',
            projectPath: '/project',
            references: [
                { commandType: 'background', filePath: '/project/scenes/intro.json', path: [0], sceneName: 'intro' },
            ],
        });

        expect(count).toBe(1);
        expect(scene.commands[0]?.assetUrl).toBe('bg/office-night.png');
        expect(scene.commands[1]?.assetUrl).toBe('/assets/sfx/click.wav:tap');
    });

    it('rewrites macro command paths from scanner display paths', () => {
        const macros = {
            greet: [
                { assetUrl: '/assets/sprites/hero.png', type: 'sprite' },
            ],
        };

        const count = rewriteAssetReferencesInJson(macros, {
            filePath: '/project/data/macros.json',
            newAssetUrl: '/assets/sprites/hero2.png',
            oldAssetUrl: '/assets/sprites/hero.png',
            projectPath: '/project',
            references: [
                { commandType: 'sprite', filePath: '/project/data/macros.json', path: [0, 'body', 0], sceneName: 'macro:greet' },
            ],
        });

        expect(count).toBe(1);
        expect(macros.greet[0]?.assetUrl).toBe('/assets/sprites/hero2.png');
    });

    it('rewrites descriptor-relative source references relative to the descriptor file', () => {
        const descriptor = {
            frames: {},
            source: 'hero.png',
        };

        const count = rewriteAssetReferencesInJson(descriptor, {
            filePath: '/project/assets/sprites/hero.sheet.json',
            newAssetUrl: '/assets/sprites/hero-renamed.png',
            oldAssetUrl: '/assets/sprites/hero.png',
            projectPath: '/project',
            references: [
                {
                    commandType: 'character.spritesheet.source',
                    filePath: '/project/assets/sprites/hero.sheet.json',
                    path: ['source'],
                    sceneName: 'data:characters',
                },
            ],
        });

        expect(count).toBe(1);
        expect(descriptor.source).toBe('hero-renamed.png');
    });

    it('formats replacements in the same visible asset-reference style', () => {
        expect(formatAssetReferenceReplacement('/assets/bgm/theme.ogg:loop', {
            filePath: '/project/scripts/intro.json',
            newAssetUrl: '/assets/bgm/theme2.ogg',
            projectPath: '/project',
        })).toBe('/assets/bgm/theme2.ogg:loop');

        expect(formatAssetReferenceReplacement('assets/bg/office.png', {
            filePath: '/project/scripts/intro.json',
            newAssetUrl: '/assets/bg/office2.png',
            projectPath: '/project',
        })).toBe('assets/bg/office2.png');
    });

    it('blocks rewrite plans when referenced files are dirty', async () => {
        const plan = await prepareAssetReferenceRewritePlan({
            dirtyFiles: new Set(['/project/scenes/intro.json']),
            newAssetUrl: '/assets/bg/office2.png',
            oldAssetUrl: '/assets/bg/office.png',
            projectPath: '/project',
            references: [
                { commandType: 'background', filePath: '/project/scenes/intro.json', path: [0], sceneName: 'intro' },
            ],
        });

        expect(plan.blockedDirtyFiles).toEqual(['/project/scenes/intro.json']);
        expect(plan.files).toEqual([]);
    });

    it('prepares and applies rewritten file payloads', async () => {
        const writeTextFile = vi.fn(() => Promise.resolve());
        const plan = await prepareAssetReferenceRewritePlan({
            newAssetUrl: '/assets/bg/office2.png',
            oldAssetUrl: '/assets/bg/office.png',
            projectPath: '/project',
            references: [
                { commandType: 'background', filePath: '/project/scenes/intro.json', path: [0], sceneName: 'intro' },
            ],
        }, {
            readTextFile: () => Promise.resolve(JSON.stringify({
                commands: [{ assetUrl: 'bg/office.png', type: 'background' }],
            })),
            writeTextFile,
        });

        expect(getDirtyAssetReferenceFiles(plan.files.map((file) => ({
            commandType: 'test',
            filePath: file.filePath,
            path: [],
            sceneName: 'test',
        })), new Set())).toEqual([]);
        expect(plan.replacementCount).toBe(1);
        expect(plan.files[0]?.content).toContain('"assetUrl": "bg/office2.png"');

        await applyAssetReferenceRewritePlan(plan, { writeTextFile });
        expect(writeTextFile).toHaveBeenCalledWith('/project/scenes/intro.json', plan.files[0]?.content);
    });
});

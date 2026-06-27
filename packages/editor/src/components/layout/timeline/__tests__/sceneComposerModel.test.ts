import { describe, expect, it } from 'vitest';

import type { PluginNode } from '../../../../plugins/types';

import {
    resolveGraphLabelInsertIndex,
    resolveGraphLabelInsertion,
    resolveMissingGraphLabelCreations,
    resolveMissingGraphSceneCreations,
    resolveSceneComposerTargetIndex,
    summarizeSceneComposer,
} from '../sceneComposerModel';

describe('sceneComposerModel', () => {
    it('summarizes the active stage state through the full scene', () => {
        const snapshot = summarizeSceneComposer([
            { assetUrl: '/assets/bg/studio.svg', type: 'background' },
            { action: 'play', assetUrl: '/assets/bgm/theme.ogg', type: 'bgm' },
            { action: 'show', assetUrl: '/assets/sprites/aria.svg', id: 'aria', pose: 'smile', type: 'sprite', xRatio: 0.25 },
            { lineId: 'intro.001', speaker: 'Aria', text: 'Hello.', type: 'dialogue', voice: '/assets/voice/001.ogg' },
            { assetUrl: '/assets/sfx/chime.wav', type: 'sfx' },
            { action: 'hide', id: 'aria', type: 'sprite' },
            { action: 'start', id: 'rain-window', layer: 'foreground', preset: 'rain', type: 'weather' },
        ] satisfies PluginNode[]);

        expect(snapshot.background).toBe('/assets/bg/studio.svg');
        expect(snapshot.bgm).toBe('play /assets/bgm/theme.ogg');
        expect(snapshot.sprites).toEqual([]);
        expect(snapshot.weather).toEqual([
            {
                action: 'start',
                id: 'rain-window',
                layer: 'foreground',
                preset: 'rain',
            },
        ]);
        expect(snapshot.totals).toMatchObject({
            backgrounds: 1,
            bgm: 1,
            dialogue: 1,
            sfx: 1,
            sprites: 2,
            voice: 1,
            weather: 1,
        });
        expect(snapshot.warnings).toEqual([]);
    });

    it('limits the snapshot to the selected root command', () => {
        const nodes: PluginNode[] = [
            { assetUrl: '/assets/bg/studio.svg', type: 'background' },
            { action: 'show', id: 'aria', pose: 'neutral', type: 'sprite' },
            { action: 'hide', id: 'aria', type: 'sprite' },
        ];

        const snapshot = summarizeSceneComposer(nodes, { selectedPaths: [[1]] });

        expect(snapshot.targetIndex).toBe(1);
        expect(snapshot.coveredCommands).toBe(2);
        expect(snapshot.sprites).toEqual([
            {
                action: 'show',
                assetUrl: undefined,
                id: 'aria',
                pose: 'neutral',
                x: undefined,
                y: undefined,
            },
        ]);
    });

    it('reports dialogue staging warnings', () => {
        const snapshot = summarizeSceneComposer([
            { speaker: 'Aria', text: 'Missing metadata.', type: 'dialogue' },
        ] satisfies PluginNode[]);

        expect(snapshot.totals.missingLineIds).toBe(1);
        expect(snapshot.warnings).toEqual([
            'No background is active before dialogue.',
            'No visible sprites are active before dialogue.',
            '1 dialogue lines need line IDs.',
        ]);
    });

    it('follows macro calls when summarizing stage state', () => {
        const snapshot = summarizeSceneComposer([
            { name: 'enter_studio_evening', type: 'call' },
            { action: 'show', id: 'aria', pose: 'smile', type: 'sprite' },
            { lineId: 'chapter_one.opening.001', speaker: 'Aria', text: 'Ready.', type: 'dialogue' },
        ] satisfies PluginNode[], {
            macros: [
                {
                    commands: [
                        { action: 'fade_out', type: 'transition' },
                        { assetUrl: '/assets/bg/studio-evening.svg', type: 'background' },
                        { action: 'fade_in', type: 'transition' },
                    ],
                    name: 'enter_studio_evening',
                },
            ],
        });

        expect(snapshot.background).toBe('/assets/bg/studio-evening.svg');
        expect(snapshot.totals.backgrounds).toBe(1);
        expect(snapshot.totals.transitions).toBe(2);
        expect(snapshot.warnings).toEqual([]);
    });

    it('does not recurse forever through cyclic macro calls', () => {
        const snapshot = summarizeSceneComposer([
            { name: 'loop', type: 'call' },
        ] satisfies PluginNode[], {
            macros: [
                {
                    commands: [
                        { name: 'loop', type: 'call' },
                        { assetUrl: '/assets/bg/studio.svg', type: 'background' },
                    ],
                    name: 'loop',
                },
            ],
        });

        expect(snapshot.background).toBe('/assets/bg/studio.svg');
        expect(snapshot.totals.backgrounds).toBe(1);
    });

    it('summarizes graph labels, gotos, and jump targets for the active scene', () => {
        const snapshot = summarizeSceneComposer([
            { name: 'start', type: 'label' },
            {
                options: [
                    { commands: [{ label: 'start', type: 'goto' }], label: 'Loop' },
                    { commands: [{ to: 'missing-scene', type: 'jump' }], label: 'Leave' },
                ],
                type: 'choice',
            },
            { to: 'credits', type: 'jump' },
        ] satisfies PluginNode[], {
            knownScenes: ['intro', 'credits'],
            sceneName: 'intro',
        });

        expect(snapshot.graph).toEqual({
            calls: [],
            currentSceneName: 'intro',
            gotos: [{
                label: 'start',
                path: [1, 'options', 0, 'commands', 0],
                status: 'ok',
                targetPath: [0],
            }],
            jumps: [
                {
                    path: [1, 'options', 1, 'commands', 0],
                    status: 'missing',
                    targetScene: 'missing-scene',
                },
                {
                    path: [2],
                    status: 'ok',
                    targetScene: 'credits',
                },
            ],
            labels: [{
                name: 'start',
                path: [0],
            }],
            missingTargets: 1,
        });
        expect(snapshot.warnings).toContain('1 graph target need attention.');
    });

    it('summarizes macro calls in the scene graph', () => {
        const snapshot = summarizeSceneComposer([
            { name: 'setup_stage', type: 'call' },
            {
                commands: [
                    { name: 'missing_macro', type: 'call' },
                ],
                type: 'block',
            },
            { name: '', type: 'call' },
        ] satisfies PluginNode[], {
            macros: [
                {
                    commands: [{ assetUrl: '/assets/bg/studio.svg', type: 'background' }],
                    name: 'setup_stage',
                },
            ],
        });

        expect(snapshot.graph.calls).toEqual([
            {
                macroName: 'setup_stage',
                path: [0],
                status: 'ok',
            },
            {
                macroName: 'missing_macro',
                path: [1, 'commands', 0],
                status: 'missing',
            },
            {
                macroName: '',
                path: [2],
                status: 'missing',
            },
        ]);
        expect(snapshot.graph.missingTargets).toBe(2);
        expect(snapshot.warnings).toContain('2 graph targets need attention.');
    });

    it('resolves selected root command indices only', () => {
        expect(resolveSceneComposerTargetIndex([['options', 0]], 3)).toBeUndefined();
        expect(resolveSceneComposerTargetIndex([[4], [1]], 3)).toBe(1);
    });

    it('resolves root insertion points for graph label creation', () => {
        expect(resolveGraphLabelInsertIndex([2, 'options', 0, 'commands', 0], 5)).toBe(3);
        expect(resolveGraphLabelInsertIndex(['options', 0], 5)).toBe(5);
        expect(resolveGraphLabelInsertIndex([8], 5)).toBe(5);
    });

    it('resolves nested insertion points for graph label creation', () => {
        expect(resolveGraphLabelInsertion([2], 5)).toEqual({
            arrayPath: [],
            index: 3,
            nodePath: [3],
        });
        expect(resolveGraphLabelInsertion([2, 'options', 0, 'commands', 0], 5)).toEqual({
            arrayPath: [2, 'options', 0, 'commands'],
            index: 1,
            nodePath: [2, 'options', 0, 'commands', 1],
        });
        expect(resolveGraphLabelInsertion(['options', 0], 5)).toEqual({
            arrayPath: [],
            index: 5,
            nodePath: [5],
        });
    });

    it('resolves bulk missing label creations in safe insertion order', () => {
        expect(resolveMissingGraphLabelCreations([
            { label: 'root', path: [1], status: 'missing' },
            { label: 'nested', path: [2, 'options', 0, 'commands', 0], status: 'missing' },
            { label: 'root', path: [3], status: 'missing' },
            { label: 'known', path: [4], status: 'ok', targetPath: [0] },
            { label: '', path: [5], status: 'missing' },
        ], 6)).toEqual([
            {
                arrayPath: [2, 'options', 0, 'commands'],
                index: 1,
                label: 'nested',
                nodePath: [2, 'options', 0, 'commands', 1],
                sourcePath: [2, 'options', 0, 'commands', 0],
            },
            {
                arrayPath: [],
                index: 2,
                label: 'root',
                nodePath: [2],
                sourcePath: [1],
            },
        ]);
    });

    it('resolves unique missing jump scenes for bulk creation', () => {
        expect(resolveMissingGraphSceneCreations([
            { path: [0], status: 'missing', targetScene: 'ending' },
            { path: [1], status: 'ok', targetScene: 'credits' },
            { path: [2], status: 'missing', targetScene: 'ending' },
            { path: [3], status: 'missing', targetScene: ' bonus ' },
            { path: [4], status: 'missing', targetScene: '' },
        ])).toEqual(['ending', 'bonus']);
    });
});

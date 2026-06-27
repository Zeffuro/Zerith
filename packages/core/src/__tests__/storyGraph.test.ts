import { describe, expect, it } from 'vitest';

import type { BaseCommand } from '../types';

import { analyzeStoryGraph } from '../utils/StoryGraph';

describe('story graph analysis', () => {
    it('collects labels, nested gotos, scene jumps, and reachability', () => {
        const scenes: Record<string, BaseCommand[]> = {
            ending: [
                { name: 'ending.start', type: 'label' },
            ],
            intro: [
                { name: 'intro.start', type: 'label' },
                {
                    options: [
                        {
                            commands: [
                                { label: 'intro.join', type: 'goto' },
                            ],
                            label: 'Join',
                        },
                    ],
                    type: 'choice',
                },
                { name: 'intro.join', type: 'label' },
                { to: 'ending', type: 'jump' },
            ],
        };

        const analysis = analyzeStoryGraph(scenes, { startScene: 'intro' });

        expect(analysis.issues).toEqual([]);
        expect(analysis.labelsByScene).toEqual({
            ending: ['ending.start'],
            intro: ['intro.join', 'intro.start'],
        });
        expect(analysis.labelReferences).toMatchObject([
            {
                label: 'intro.join',
                path: [1, 4, 0, 0],
                sceneName: 'intro',
            },
        ]);
        expect(analysis.sceneEdges).toMatchObject([
            {
                fromScene: 'intro',
                path: [3],
                targetScene: 'ending',
                type: 'jump',
            },
        ]);
        expect(analysis.reachableScenes).toEqual(['ending', 'intro']);
        expect(analysis.unreachableScenes).toEqual([]);
    });

    it('reports duplicate labels, missing labels, missing scenes, and unreachable scenes', () => {
        const scenes: Record<string, BaseCommand[]> = {
            intro: [
                { name: 'intro.start', type: 'label' },
                { name: 'intro.start', type: 'label' },
                { label: 'intro.missing', type: 'goto' },
                { to: 'missing_scene', type: 'jump' },
            ],
            unused: [
                { name: 'unused.start', type: 'label' },
            ],
        };

        const analysis = analyzeStoryGraph(scenes, { startScene: 'intro' });

        expect(analysis.issues.map((issue) => issue.code)).toEqual([
            'duplicate_label',
            'missing_label',
            'missing_scene',
            'unreachable_scene',
        ]);
        expect(analysis.issues).toMatchObject([
            {
                code: 'duplicate_label',
                label: 'intro.start',
                path: [1],
                sceneName: 'intro',
            },
            {
                code: 'missing_label',
                label: 'intro.missing',
                path: [2],
                sceneName: 'intro',
            },
            {
                code: 'missing_scene',
                path: [3],
                sceneName: 'intro',
                targetScene: 'missing_scene',
            },
            {
                code: 'unreachable_scene',
                sceneName: 'unused',
            },
        ]);
    });

    it('reports a missing start scene', () => {
        const analysis = analyzeStoryGraph({
            intro: [
                { name: 'intro.start', type: 'label' },
            ],
        }, { startScene: 'missing_start' });

        expect(analysis.reachableScenes).toEqual([]);
        expect(analysis.issues).toMatchObject([
            {
                code: 'missing_start_scene',
                targetScene: 'missing_start',
            },
            {
                code: 'unreachable_scene',
                sceneName: 'intro',
            },
        ]);
    });
});

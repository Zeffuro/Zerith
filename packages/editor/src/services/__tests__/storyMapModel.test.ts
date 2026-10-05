import type { BaseCommand } from '@zeffuro/zerith-core/types';

import { describe, expect, it } from 'vitest';

import { buildStoryMap, filterStoryMap, layoutStoryMap, nextStoryMapNode } from '../storyMap/storyMapModel';
import { defaultStoryMapPreferences, readStoryMapPreferences, saveStoryMapPreferences } from '../storyMap/storyMapPreferences';
import { storyMapVisited, storyMapVisitedEdges } from '../storyMap/storyMapProject';

const scenes = {
    ending: [],
    intro: [{ id: 'Choose a route', options: [
        { commands: [{ to: 'station', type: 'jump' }], label: 'Take the train' },
        { commands: [{ text: 'The rain continues.', type: 'dialogue' }], label: 'Wait here' },
    ], type: 'choice' }, { name: 'greeting', type: 'call' }],
    lonely: [],
    station: [{ to: 'ending', type: 'jump' }, { to: 'missing_platform', type: 'jump' }],
} as Record<string, BaseCommand[]>;

function map() {
    return buildStoryMap({ macros: { greeting: [{ to: 'ending', type: 'jump' }] }, macroSources: { greeting: { filePath: '/Game/macros.json', jsonPath: ['greeting'] } },
        scenes,
        sceneSources: { intro: { filePath: '/Game/intro.json', jsonPath: [], scriptPath: [] } }, startScene: 'intro' });
}

describe('story map routes and navigation', () => {
    it('retains both choice branches and exact nested command source paths', () => {
        const graph = map();
        const route = graph.edges.find(edge => edge.label === 'Take the train')!;
        expect(route.to).toBe('scene:station');
        expect(route.source).toEqual({ filePath: '/Game/intro.json', jsonPath: [0, 'options', 0, 'commands', 0], scriptPath: [0, 'options', 0, 'commands', 0] });
        expect(graph.edges.some(edge => edge.label === 'Wait here' && edge.to === 'scene:intro')).toBe(true);
        expect(graph.nodes.some(node => node.kind === 'choice')).toBe(true);
        expect(graph.nodes.find(node => node.kind === 'choice')?.label).toBe('Choose a route');
    });

    it('distinguishes macro calls and maps macro command sources without modifying scripts', () => {
        const before = JSON.stringify(scenes);
        const graph = map();
        expect(graph.edges.find(edge => edge.type === 'call')).toMatchObject({ from: 'scene:intro', to: 'macro:greeting' });
        expect(graph.edges.find(edge => edge.from === 'macro:greeting')?.source).toEqual({ filePath: '/Game/macros.json', jsonPath: ['greeting', 0], scriptPath: undefined });
        expect(JSON.stringify(scenes)).toBe(before);
    });

    it('marks missing references and unreachable nodes with one-hop filter context', () => {
        const graph = map();
        expect(graph.nodes.find(node => node.id === 'scene:lonely')?.reachable).toBe(false);
        expect(graph.nodes.find(node => node.id === 'scene:missing_platform')?.missing).toBe(true);
        const missing = filterStoryMap(graph, 'missing', '', true);
        expect(missing.nodes.map(node => node.id)).toEqual(['scene:station', 'scene:missing_platform']);
        expect(filterStoryMap(graph, 'unreachable', '', true).nodes.map(node => node.id)).toEqual(['scene:lonely']);
        const noMacros = filterStoryMap(graph, 'all', '', false);
        expect(noMacros.nodes.some(node => node.kind === 'macro')).toBe(false);
        expect(noMacros.edges.some(edge => edge.to === 'macro:greeting')).toBe(false);
    });

    it('computes macro-mediated reachability and handles a missing starting scene', () => {
        const graph = buildStoryMap({ macros: { detour: [{ to: 'ending', type: 'jump' }] }, scenes: { ending: [], intro: [{ name: 'detour', type: 'call' }] }, startScene: 'intro' });
        expect(graph.nodes.every(node => node.reachable)).toBe(true);
        expect(buildStoryMap({ scenes: {}, startScene: 'gone' }).nodes[0]).toMatchObject({ id: 'scene:gone', missing: true });
    });

    it('includes missing local labels and keeps macro choices out of the hidden macro view', () => {
        const graph = buildStoryMap({ macros: { menu: [{ options: [{ commands: [], label: 'Wait' }], type: 'choice' }] }, scenes: { intro: [{ label: 'gone', type: 'goto' }] }, startScene: 'intro' });
        expect(filterStoryMap(graph, 'missing', '', true).nodes.some(node => node.id === 'label:scene:intro:gone')).toBe(true);
        expect(filterStoryMap(graph, 'all', '', false).nodes.some(node => node.owner === 'macro:menu')).toBe(false);
    });

    it('lays out all nodes deterministically and navigates in the requested direction', () => {
        const graph = map();
        const positions = layoutStoryMap(graph);
        expect(positions).toEqual(layoutStoryMap(graph));
        expect(Object.keys(positions)).toHaveLength(graph.nodes.length);
        const right = nextStoryMapNode('scene:intro', 'right', graph.nodes, positions)!;
        expect(positions[right].x).toBeGreaterThan(positions['scene:intro'].x);
    });

    it('covers every node and edge in a large cyclic story', () => {
        const large = Object.fromEntries(Array.from({ length: 1500 }, (_, index) => [`scene_${index}`, [{ to: `scene_${(index + 1) % 1500}`, type: 'jump' }]])) as Record<string, BaseCommand[]>;
        const graph = buildStoryMap({ scenes: large, startScene: 'scene_0' });
        expect(graph.nodes).toHaveLength(1500);
        expect(graph.edges).toHaveLength(1500);
        expect(graph.nodes.every(node => node.reachable)).toBe(true);
        expect(Object.keys(layoutStoryMap(graph))).toHaveLength(1500);
    });

    it('highlights actual adjacent scene transitions including returns and excludes another project', () => {
        const graph = map();
        const request = { projectPath: '/Game', scenario: { scene: 'intro' } };
        const visited = ['preview', 'station', 'ending', 'station'];
        expect(storyMapVisited('/Game', visited, request)).toEqual(new Set(['scene:ending', 'scene:intro', 'scene:station']));
        const edges = storyMapVisitedEdges(graph, '/Game', visited, request);
        expect([...edges].map(id => graph.edges.find(edge => edge.id === id)?.to)).toEqual(['scene:station', 'scene:ending']);
        expect(storyMapVisitedEdges(graph, '/Other/Game', visited, request).size).toBe(0);
        expect(storyMapVisited('/Other/Game', visited, request).size).toBe(0);
    });

    it('stores camera filters and layout separately for same-named projects and bounds invalid values', () => {
        const data = new Map<string, string>();
        const storage = { getItem: (key: string) => data.get(key) ?? '', setItem: (key: string, value: string) => { data.set(key, value); } };
        const preferences = { ...defaultStoryMapPreferences, positions: { 'scene:intro': { x: 18, y: 32 } }, query: 'station', zoom: .5 };
        saveStoryMapPreferences('/One/Game', preferences, storage);
        expect(readStoryMapPreferences('/One/Game', storage)).toEqual(preferences);
        expect(readStoryMapPreferences('/Two/Game', storage)).toEqual(defaultStoryMapPreferences);
        saveStoryMapPreferences('/One/Game', { ...preferences, zoom: 100 }, storage);
        expect(readStoryMapPreferences('/One/Game', storage).zoom).toBe(2);
        storage.setItem('zerith-story-map-view-v1', '{broken');
        expect(() => readStoryMapPreferences('/One/Game', storage)).toThrow();
    });
});

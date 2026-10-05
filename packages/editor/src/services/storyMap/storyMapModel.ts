import type { BaseCommand } from '@zeffuro/zerith-core/types';

import { analyzeStoryGraph } from '@zeffuro/zerith-core/utils/StoryGraph';

import type { ScriptPath } from '../../utils/scriptPathUtilities';

import { isRecord } from '../../utils/typeGuards';

export type StoryMap = { edges: StoryMapEdge[]; issues: string[]; nodes: StoryMapNode[]; startId?: string };
export type StoryMapEdge = { from: string; id: string; label: string; source?: StoryMapSource; to: string; type: 'call' | 'choice' | 'goto' | 'jump' };
export type StoryMapFilter = 'all' | 'missing' | 'unreachable';
export type StoryMapInput = {
    macros?: Record<string, BaseCommand[]>;
    macroSources?: Record<string, StoryMapSource>;
    scenes: Record<string, BaseCommand[]>;
    sceneSources?: Record<string, StoryMapSource>;
    startScene?: string;
};
export type StoryMapNode = { id: string; kind: 'choice' | 'macro' | 'missing' | 'scene'; label: string; missing: boolean; owner?: string; reachable: boolean; source?: StoryMapSource };
export type StoryMapPosition = { x: number; y: number };
export type StoryMapSource = { filePath: string; jsonPath?: ScriptPath; scriptPath?: ScriptPath };

export function buildStoryMap(input: StoryMapInput): StoryMap {
    const analysis = analyzeStoryGraph(input.scenes, { startScene: input.startScene });
    const macroAnalysis = analyzeStoryGraph(input.macros ?? {});
    const labels = new Map<string, string[]>([...Object.entries(analysis.labelsByScene).map(([name, values]) => [`scene:${name}`, values] as const), ...Object.entries(macroAnalysis.labelsByScene).map(([name, values]) => [`macro:${name}`, values] as const)]);
    const nodes = new Map<string, StoryMapNode>();
    const edges: StoryMapEdge[] = [];
    const sources = { ...Object.fromEntries(Object.entries(input.sceneSources ?? {}).map(([name, source]) => [`scene:${name}`, source])), ...Object.fromEntries(Object.entries(input.macroSources ?? {}).map(([name, source]) => [`macro:${name}`, source])) };
    for (const name of Object.keys(input.scenes)) nodes.set(`scene:${name}`, { id: `scene:${name}`, kind: 'scene', label: name, missing: false, reachable: false, source: sources[`scene:${name}`] });
    for (const name of Object.keys(input.macros ?? {})) nodes.set(`macro:${name}`, { id: `macro:${name}`, kind: 'macro', label: name, missing: false, reachable: false, source: sources[`macro:${name}`] });
    const addEdge = (from: string, to: string, label: string, type: StoryMapEdge['type'], source?: StoryMapSource) => {
        if (!nodes.has(to)) nodes.set(to, { id: to, kind: 'missing', label: to.slice(to.indexOf(':') + 1), missing: true, reachable: false });
        edges.push({ from, id: `edge:${edges.length}`, label, source, to, type });
    };
    const visit = (commands: BaseCommand[], owner: string, origin: string, basePath: ScriptPath = [], branchLabel = '') => {
        for (const [index, command] of commands.entries()) {
            const path = [...basePath, index];
            const value = command as unknown as Record<string, unknown>;
            const source = sourceAtPath(sources[owner], path);
            if (value.type === 'jump' && typeof value.to === 'string') addEdge(origin, `scene:${value.to}`, branchLabel || `Jump to ${value.to}`, 'jump', source);
            if (value.type === 'call' && typeof value.name === 'string') addEdge(origin, `macro:${value.name}`, branchLabel || `Call ${value.name}`, 'call', source);
            if (value.type === 'goto' && typeof value.label === 'string') addEdge(origin, labels.get(owner)?.includes(value.label) ? owner : `label:${owner}:${value.label}`, branchLabel ? `${branchLabel} / ${value.label}` : `Go to ${value.label}`, 'goto', source);
            if (value.type === 'choice' && Array.isArray(value.options)) {
                const id = `choice:${owner}:${JSON.stringify(path)}`;
                nodes.set(id, { id, kind: 'choice', label: typeof value.id === 'string' ? value.id : (typeof value.analyticsLabel === 'string' ? value.analyticsLabel : `Choice ${index + 1}`), missing: false, owner, reachable: false, source });
                addEdge(origin, id, branchLabel || 'Choice', 'choice', source);
                for (const [optionIndex, option] of value.options.entries()) {
                    if (!isRecord(option)) continue;
                    const label = typeof option.label === 'string' ? option.label : `Option ${optionIndex + 1}`;
                    const previousEdgeCount = edges.length;
                    if (Array.isArray(option.commands)) visit(option.commands as BaseCommand[], owner, id, [...path, 'options', optionIndex, 'commands'], label);
                    if (edges.length === previousEdgeCount) addEdge(id, owner, label, 'choice', source);
                }
            }
            for (const key of ['body', 'commands', 'onFalse', 'onTrue']) {
                if (Array.isArray(value[key])) visit(value[key] as BaseCommand[], owner, origin, [...path, key], branchLabel);
            }
        }
    };
    for (const [name, commands] of Object.entries(input.scenes)) visit(commands, `scene:${name}`, `scene:${name}`);
    for (const [name, commands] of Object.entries(input.macros ?? {})) visit(commands, `macro:${name}`, `macro:${name}`);
    const startId = input.startScene ? `scene:${input.startScene}` : (Object.keys(input.scenes)[0] ? `scene:${Object.keys(input.scenes)[0]}` : undefined);
    if (startId && !nodes.has(startId)) nodes.set(startId, { id: startId, kind: 'missing', label: input.startScene ?? '', missing: true, reachable: false });
    const outgoing = new Map<string, string[]>();
    for (const edge of edges) outgoing.set(edge.from, [...outgoing.get(edge.from) ?? [], edge.to]);
    const pending = startId ? [startId] : [];
    const visited = new Set<string>();
    for (let cursor = 0; cursor < pending.length; cursor++) {
        const id = pending[cursor];
        if (visited.has(id)) continue;
        visited.add(id);
        nodes.get(id)!.reachable = true;
        pending.push(...outgoing.get(id) ?? []);
    }
    return { edges, issues: [...analysis.issues.filter(issue => issue.code !== 'unreachable_scene'), ...macroAnalysis.issues.filter(issue => issue.code === 'missing_label' || issue.code === 'duplicate_label')].map(issue => issue.message), nodes: [...nodes.values()], startId };
}

export function filterStoryMap(map: StoryMap, filter: StoryMapFilter, query: string, showMacros: boolean): StoryMap {
    const term = query.trim().toLowerCase();
    const visible = (node: StoryMapNode) => showMacros || (node.kind !== 'macro' && !node.owner?.startsWith('macro:'));
    const matches = new Set(map.nodes.filter(node => visible(node) && (!term || node.label.toLowerCase().includes(term))
        && (filter === 'all' || (filter === 'missing' ? node.missing : !node.reachable && !node.missing))).map(node => node.id));
    if (filter !== 'all') {
        const seeds = new Set(matches);
        for (const edge of map.edges) if (seeds.has(edge.to) || seeds.has(edge.from)) { matches.add(edge.from); matches.add(edge.to); }
    }
    const nodes = map.nodes.filter(node => matches.has(node.id) && visible(node));
    const visibleIds = new Set(nodes.map(node => node.id));
    return { ...map, edges: map.edges.filter(edge => visibleIds.has(edge.from) && visibleIds.has(edge.to)), nodes };
}

export function layoutStoryMap(map: StoryMap): Record<string, StoryMapPosition> {
    const depths = new Map<string, number>();
    if (map.startId) depths.set(map.startId, 0);
    const outgoing = new Map<string, string[]>();
    for (const edge of map.edges) outgoing.set(edge.from, [...outgoing.get(edge.from) ?? [], edge.to]);
    const pending = map.startId ? [map.startId] : [];
    for (let cursor = 0; cursor < pending.length; cursor++) {
        const from = pending[cursor];
        for (const to of outgoing.get(from) ?? []) {
            if (depths.has(to)) continue;
            depths.set(to, Math.min(8, (depths.get(from) ?? 0) + 1));
            pending.push(to);
        }
    }
    const rows = new Map<number, number>();
    return Object.fromEntries(map.nodes.map(node => {
        const column = depths.get(node.id) ?? 0;
        const row = rows.get(column) ?? 0;
        rows.set(column, row + 1);
        return [node.id, { x: 32 + column * 250, y: 32 + row * 110 }];
    }));
}

export function nextStoryMapNode(id: string, direction: 'down' | 'left' | 'right' | 'up', nodes: StoryMapNode[], positions: Record<string, StoryMapPosition>): string | undefined {
    const origin = positions[id];
    if (!origin) return nodes[0]?.id;
    const candidates = nodes.filter(node => node.id !== id).map(node => {
        const position = positions[node.id];
        const horizontal = position.x - origin.x;
        const vertical = position.y - origin.y;
        const primary = { down: vertical, left: -horizontal, right: horizontal, up: -vertical }[direction];
        const secondary = direction === 'left' || direction === 'right' ? Math.abs(vertical) : Math.abs(horizontal);
        return { id: node.id, primary, score: primary + secondary * 2 };
    }).filter(candidate => candidate.primary > 0).toSorted((left, right) => left.score - right.score);
    return candidates[0]?.id;
}

function sourceAtPath(source: StoryMapSource | undefined, path: ScriptPath): StoryMapSource | undefined {
    if (!source) return;
    return { ...source, jsonPath: [...source.jsonPath ?? [], ...path], scriptPath: source.scriptPath === undefined ? undefined : [...source.scriptPath, ...path] };
}

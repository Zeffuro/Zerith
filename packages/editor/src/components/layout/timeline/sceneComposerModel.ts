import type { PluginNode } from '../../../plugins/types';
import type { ScriptPath } from '../../../utils/scriptPathUtilities';
import type { SceneComposerSelectionSummary } from './sceneComposerPathModel';

import { summarizeSceneComposerSelection } from './sceneComposerPathModel';

export type SceneComposerCue = {
    detail: string;
    kind: 'audio' | 'branch' | 'dialogue' | 'effect' | 'scene' | 'visual';
    label: string;
};

export type SceneComposerGraphGoto = {
    label: string;
    path: ScriptPath;
    status: SceneComposerGraphTargetStatus;
    targetPath?: ScriptPath;
};

export type SceneComposerGraphJump = {
    path: ScriptPath;
    status: SceneComposerGraphTargetStatus;
    targetScene: string;
};

export type SceneComposerGraphLabel = {
    name: string;
    path: ScriptPath;
};

export type SceneComposerGraphMacroCall = {
    macroName: string;
    path: ScriptPath;
    status: SceneComposerGraphTargetStatus;
};

export type SceneComposerGraphSummary = {
    calls: SceneComposerGraphMacroCall[];
    currentSceneName: string | undefined;
    gotos: SceneComposerGraphGoto[];
    jumps: SceneComposerGraphJump[];
    labels: SceneComposerGraphLabel[];
    missingTargets: number;
};

export type SceneComposerGraphTargetStatus = 'missing' | 'ok' | 'unknown';

export type SceneComposerLabelInsertion = {
    arrayPath: ScriptPath;
    index: number;
    nodePath: ScriptPath;
};

export type SceneComposerMacroEntry = {
    commands: PluginNode[];
    name: string;
};

export type SceneComposerMissingLabelCreation = {
    label: string;
    sourcePath: ScriptPath;
} & SceneComposerLabelInsertion;

export type SceneComposerOptions = {
    knownScenes?: readonly string[];
    macros?: readonly SceneComposerMacroEntry[];
    sceneName?: string;
    selectedPaths?: ScriptPath[];
};

export type SceneComposerSnapshot = {
    background: string | undefined;
    bgm: string | undefined;
    coveredCommands: number;
    graph: SceneComposerGraphSummary;
    recentCues: SceneComposerCue[];
    selection: SceneComposerSelectionSummary;
    sprites: SceneComposerSpriteState[];
    targetIndex: number | undefined;
    totalCommands: number;
    totals: SceneComposerTotals;
    warnings: string[];
    weather: SceneComposerWeatherState[];
};

export type SceneComposerSpriteState = {
    action: string;
    assetUrl: string | undefined;
    id: string;
    pose: string | undefined;
    x: number | undefined;
    y: number | undefined;
};

export type SceneComposerTotals = {
    backgrounds: number;
    bgm: number;
    choices: number;
    dialogue: number;
    jumps: number;
    missingLineIds: number;
    sceneChanges: number;
    sfx: number;
    sprites: number;
    transitions: number;
    voice: number;
    weather: number;
};

export type SceneComposerWeatherState = {
    action: string;
    id: string;
    layer: string | undefined;
    preset: string;
};

const DEFAULT_TOTALS: SceneComposerTotals = {
    backgrounds: 0,
    bgm: 0,
    choices: 0,
    dialogue: 0,
    jumps: 0,
    missingLineIds: 0,
    sceneChanges: 0,
    sfx: 0,
    sprites: 0,
    transitions: 0,
    voice: 0,
    weather: 0,
};

export function resolveGraphLabelInsertIndex(path: ScriptPath, totalCommands: number): number {
    const rootIndex = path[0];
    if (typeof rootIndex !== 'number') return totalCommands;
    return Math.max(0, Math.min(rootIndex + 1, totalCommands));
}

export function resolveGraphLabelInsertion(path: ScriptPath, totalCommands: number): SceneComposerLabelInsertion {
    const rootIndex = path[0];
    const sourceIndex = path.at(-1);
    if (typeof rootIndex !== 'number' || typeof sourceIndex !== 'number') {
        const index = Math.max(0, totalCommands);
        return { arrayPath: [], index, nodePath: [index] };
    }

    const arrayPath = path.slice(0, -1);
    const rawIndex = sourceIndex + 1;
    const index = arrayPath.length === 0
        ? Math.max(0, Math.min(rawIndex, totalCommands))
        : Math.max(0, rawIndex);

    return {
        arrayPath,
        index,
        nodePath: [...arrayPath, index],
    };
}

export function resolveMissingGraphLabelCreations(
    gotos: readonly SceneComposerGraphGoto[],
    totalCommands: number,
): SceneComposerMissingLabelCreation[] {
    const seenLabels = new Set<string>();
    const creations: SceneComposerMissingLabelCreation[] = [];

    for (const goto of gotos) {
        const label = goto.label.trim();
        if (goto.status !== 'missing' || !label || seenLabels.has(label)) {
            continue;
        }

        seenLabels.add(label);
        creations.push({
            ...resolveGraphLabelInsertion(goto.path, totalCommands),
            label,
            sourcePath: goto.path,
        });
    }

    return creations.toSorted(compareMissingLabelCreationsForInsertion);
}

export function resolveMissingGraphMacroCreations(calls: readonly SceneComposerGraphMacroCall[]): string[] {
    const macroNames: string[] = [];
    const seenMacroNames = new Set<string>();

    for (const call of calls) {
        const macroName = call.macroName.trim();
        if (call.status !== 'missing' || !macroName || seenMacroNames.has(macroName)) {
            continue;
        }

        seenMacroNames.add(macroName);
        macroNames.push(macroName);
    }

    return macroNames;
}

export function resolveMissingGraphSceneCreations(jumps: readonly SceneComposerGraphJump[]): string[] {
    const sceneNames: string[] = [];
    const seenSceneNames = new Set<string>();

    for (const jump of jumps) {
        const sceneName = jump.targetScene.trim();
        if (jump.status !== 'missing' || !sceneName || seenSceneNames.has(sceneName)) {
            continue;
        }

        seenSceneNames.add(sceneName);
        sceneNames.push(sceneName);
    }

    return sceneNames;
}

export function resolveSceneComposerTargetIndex(
    selectedPaths: ScriptPath[],
    totalCommands: number,
): number | undefined {
    for (const path of selectedPaths) {
        const [rootIndex] = path;
        if (typeof rootIndex !== 'number') {
            continue;
        }

        if (rootIndex >= 0 && rootIndex < totalCommands) {
            return rootIndex;
        }
    }

    return undefined;
}

export function summarizeSceneComposer(
    nodes: PluginNode[],
    options: SceneComposerOptions = {},
): SceneComposerSnapshot {
    const selectedPaths = options.selectedPaths ?? [];
    const targetIndex = resolveSceneComposerTargetIndex(selectedPaths, nodes.length);
    const coveredCommands = targetIndex === undefined ? nodes.length : targetIndex + 1;
    const visitedNodes = nodes.slice(0, coveredCommands);
    const macros = new Map((options.macros ?? []).map((macro) => [macro.name, macro.commands]));
    const graph = summarizeSceneGraph(nodes, options);
    const selection = summarizeSceneComposerSelection(selectedPaths, nodes.length);

    const totals: SceneComposerTotals = { ...DEFAULT_TOTALS };
    const sprites = new Map<string, SceneComposerSpriteState>();
    const weather = new Map<string, SceneComposerWeatherState>();
    const recentCues: SceneComposerCue[] = [];
    let background: string | undefined;
    let bgm: string | undefined;
    let dialogueWithoutActiveBackground = false;
    let dialogueWithoutActiveSprite = false;

    const pushCue = (cue: SceneComposerCue) => {
        recentCues.push(cue);
        if (recentCues.length > 5) {
            recentCues.shift();
        }
    };

    const applyNode = (node: PluginNode, activeMacros: Set<string>) => {
        switch (node.type) {
            case 'background': {
                totals.backgrounds += 1;
                background = readString(node, 'assetUrl') || undefined;
                pushCue({ detail: background ?? '(no asset)', kind: 'visual', label: 'Background' });
                break;
            }
            case 'bgm': {
                totals.bgm += 1;
                const action = readString(node, 'action', 'play');
                const assetUrl = readString(node, 'assetUrl');
                bgm = action === 'stop'
                    ? undefined
                    : [action, assetUrl].filter(Boolean).join(' ') || action;
                pushCue({ detail: bgm ?? 'stop', kind: 'audio', label: 'BGM' });
                break;
            }
            case 'call': {
                const name = readString(node, 'name');
                pushCue({
                    detail: name || '(missing macro)',
                    kind: 'scene',
                    label: 'Call',
                });

                if (!name || activeMacros.has(name)) {
                    break;
                }

                const macroCommands = macros.get(name);
                if (!macroCommands) {
                    break;
                }

                activeMacros.add(name);
                for (const macroNode of macroCommands) {
                    applyNode(macroNode, activeMacros);
                }
                activeMacros.delete(name);
                break;
            }
            case 'choice': {
                totals.choices += 1;
                const optionCount = readArray(node, 'options').length;
                pushCue({ detail: `${optionCount} options`, kind: 'branch', label: 'Choice' });
                break;
            }
            case 'dialogue': {
                totals.dialogue += 1;
                if (!background) {
                    dialogueWithoutActiveBackground = true;
                }
                if (sprites.size === 0) {
                    dialogueWithoutActiveSprite = true;
                }
                if (!readString(node, 'lineId')) {
                    totals.missingLineIds += 1;
                }

                const voice = readVoiceLabel(node);
                if (voice) {
                    totals.voice += 1;
                }

                const speaker = readString(node, 'speaker', '???');
                pushCue({
                    detail: voice ? `${speaker} | voice ${voice}` : speaker,
                    kind: 'dialogue',
                    label: 'Dialogue',
                });
                break;
            }
            case 'flash':
            case 'shake': {
                pushCue({ detail: node.type, kind: 'effect', label: 'Effect' });
                break;
            }
            case 'goto':
            case 'jump': {
                totals.jumps += 1;
                pushCue({
                    detail: readString(node, node.type === 'goto' ? 'label' : 'to', '(missing target)'),
                    kind: 'branch',
                    label: node.type === 'goto' ? 'Goto' : 'Jump',
                });
                break;
            }
            case 'scene_change': {
                totals.sceneChanges += 1;
                pushCue({
                    detail: readString(node, 'assetUrl', '(no asset)'),
                    kind: 'scene',
                    label: 'Scene Change',
                });
                break;
            }
            case 'sfx': {
                totals.sfx += 1;
                pushCue({ detail: readString(node, 'assetUrl', '(no asset)'), kind: 'audio', label: 'SFX' });
                break;
            }
            case 'sprite': {
                totals.sprites += 1;
                applySpriteState(sprites, node);
                const id = readString(node, 'id', 'sprite');
                pushCue({
                    detail: `${readString(node, 'action', 'show')} ${id}`,
                    kind: 'visual',
                    label: 'Sprite',
                });
                break;
            }
            case 'transition': {
                totals.transitions += 1;
                pushCue({
                    detail: readString(node, 'action', 'fade_out'),
                    kind: 'effect',
                    label: 'Transition',
                });
                break;
            }
            case 'weather': {
                totals.weather += 1;
                applyWeatherState(weather, node);
                pushCue({
                    detail: weatherCueLabel(node),
                    kind: 'visual',
                    label: 'Weather',
                });
                break;
            }
        }
    };

    for (const node of visitedNodes) {
        applyNode(node, new Set<string>());
    }

    return {
        background,
        bgm,
        coveredCommands,
        graph,
        recentCues: recentCues.toReversed(),
        selection,
        sprites: [...sprites.values()].toSorted((left, right) => left.id.localeCompare(right.id)),
        targetIndex,
        totalCommands: nodes.length,
        totals,
        warnings: buildComposerWarnings({
            dialogueWithoutActiveBackground,
            dialogueWithoutActiveSprite,
            graphMissingTargets: graph.missingTargets,
            totals,
        }),
        weather: [...weather.values()].toSorted((left, right) => left.id.localeCompare(right.id)),
    };
}

function applySpriteState(sprites: Map<string, SceneComposerSpriteState>, node: PluginNode): void {
    const id = readString(node, 'id', 'sprite');
    const action = readString(node, 'action', 'show');
    if (action === 'hide') {
        sprites.delete(id);
        return;
    }

    const previous = sprites.get(id);
    sprites.set(id, {
        action,
        assetUrl: readString(node, 'assetUrl') || previous?.assetUrl,
        id,
        pose: readString(node, 'pose') || previous?.pose,
        x: readNumber(node, 'xRatio') ?? readNumber(node, 'x') ?? previous?.x,
        y: readNumber(node, 'yRatio') ?? readNumber(node, 'y') ?? previous?.y,
    });
}

function applyWeatherState(weather: Map<string, SceneComposerWeatherState>, node: PluginNode): void {
    const action = readString(node, 'action', 'start');
    if (action === 'clear') {
        weather.clear();
        return;
    }

    const preset = readString(node, 'preset', 'rain');
    const id = readString(node, 'id', preset);
    if (action === 'stop') {
        weather.delete(id);
        return;
    }

    weather.set(id, {
        action,
        id,
        layer: readString(node, 'layer') || undefined,
        preset,
    });
}

function buildComposerWarnings(snapshot: {
    dialogueWithoutActiveBackground: boolean;
    dialogueWithoutActiveSprite: boolean;
    graphMissingTargets: number;
    totals: SceneComposerTotals;
}): string[] {
    const warnings: string[] = [];
    if (snapshot.dialogueWithoutActiveBackground) {
        warnings.push('No background is active before dialogue.');
    }
    if (snapshot.dialogueWithoutActiveSprite) {
        warnings.push('No visible sprites are active before dialogue.');
    }
    if (snapshot.totals.missingLineIds > 0) {
        warnings.push(`${snapshot.totals.missingLineIds} dialogue lines need line IDs.`);
    }
    if (snapshot.graphMissingTargets > 0) {
        warnings.push(`${snapshot.graphMissingTargets} graph target${snapshot.graphMissingTargets === 1 ? '' : 's'} need attention.`);
    }
    return warnings;
}

function compareMissingLabelCreationsForInsertion(
    left: SceneComposerMissingLabelCreation,
    right: SceneComposerMissingLabelCreation,
): number {
    if (left.arrayPath.length !== right.arrayPath.length) {
        return right.arrayPath.length - left.arrayPath.length;
    }

    const leftKey = left.arrayPath.join('\u0000');
    const rightKey = right.arrayPath.join('\u0000');
    if (leftKey !== rightKey) {
        return rightKey.localeCompare(leftKey);
    }

    return right.index - left.index;
}

function readArray(node: PluginNode, key: string): unknown[] {
    const value = (node as Record<string, unknown>)[key];
    return Array.isArray(value) ? value : [];
}

function readNumber(node: PluginNode, key: string): number | undefined {
    const value = (node as Record<string, unknown>)[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readString(node: PluginNode, key: string, fallback = ''): string {
    const value = (node as Record<string, unknown>)[key];
    return typeof value === 'string' && value.trim() ? value : fallback;
}

function readVoiceLabel(node: PluginNode): string | undefined {
    const voice = (node as Record<string, unknown>).voice;
    if (typeof voice === 'string' && voice.trim()) {
        return voice;
    }
    if (voice && typeof voice === 'object') {
        const assetUrl = (voice as Record<string, unknown>).assetUrl;
        const cue = (voice as Record<string, unknown>).cue;
        if (typeof cue === 'string' && cue.trim()) {
            return cue;
        }
        if (typeof assetUrl === 'string' && assetUrl.trim()) {
            return assetUrl;
        }
    }
    return undefined;
}

function resolveLabelTargetStatus(label: string, labelSet: ReadonlySet<string>): SceneComposerGraphTargetStatus {
    if (!label) return 'missing';
    return labelSet.has(label) ? 'ok' : 'missing';
}

function resolveMacroTargetStatus(
    targetMacro: string,
    knownMacroSet: ReadonlySet<string> | undefined,
): SceneComposerGraphTargetStatus {
    if (!targetMacro) return 'missing';
    if (!knownMacroSet) return 'unknown';
    return knownMacroSet.has(targetMacro) ? 'ok' : 'missing';
}

function resolveSceneTargetStatus(
    targetScene: string,
    knownSceneSet: ReadonlySet<string> | undefined,
): SceneComposerGraphTargetStatus {
    if (!targetScene) return 'missing';
    if (!knownSceneSet) return 'unknown';
    return knownSceneSet.has(targetScene) ? 'ok' : 'missing';
}

function summarizeSceneGraph(nodes: PluginNode[], options: SceneComposerOptions): SceneComposerGraphSummary {
    const calls: SceneComposerGraphMacroCall[] = [];
    const labels: SceneComposerGraphLabel[] = [];
    const gotos: SceneComposerGraphGoto[] = [];
    const jumps: SceneComposerGraphJump[] = [];
    const knownSceneSet = options.knownScenes ? new Set(options.knownScenes) : undefined;
    const knownMacroSet = options.macros ? new Set(options.macros.map((macro) => macro.name)) : undefined;

    visitGraphNodes(nodes, [], (node, path) => {
        if (node.type === 'call') {
            const macroName = readString(node, 'name');
            calls.push({
                macroName,
                path,
                status: resolveMacroTargetStatus(macroName, knownMacroSet),
            });
            return;
        }

        if (node.type === 'label') {
            const name = readString(node, 'name');
            if (name) labels.push({ name, path });
            return;
        }

        if (node.type === 'goto') {
            gotos.push({
                label: readString(node, 'label'),
                path,
                status: 'unknown',
            });
            return;
        }

        if (node.type === 'jump') {
            const targetScene = readString(node, 'to');
            jumps.push({
                path,
                status: resolveSceneTargetStatus(targetScene, knownSceneSet),
                targetScene,
            });
        }
    });

    const labelPaths = new Map(labels.map((label) => [label.name, label.path]));
    const labelSet = new Set(labelPaths.keys());
    const resolvedGotos = gotos.map((goto) => ({
        ...goto,
        status: resolveLabelTargetStatus(goto.label, labelSet),
        ...(labelPaths.has(goto.label) ? { targetPath: labelPaths.get(goto.label) } : {}),
    }));
    const missingTargets = [
        ...calls.map((call) => call.status),
        ...resolvedGotos.map((goto) => goto.status),
        ...jumps.map((jump) => jump.status),
    ].filter((status) => status === 'missing').length;

    return {
        calls,
        currentSceneName: options.sceneName,
        gotos: resolvedGotos,
        jumps,
        labels,
        missingTargets,
    };
}

function visitGraphNodes(
    nodes: PluginNode[],
    basePath: ScriptPath,
    visitor: (node: PluginNode, path: ScriptPath) => void,
): void {
    for (const [index, node] of nodes.entries()) {
        const path = [...basePath, index];
        visitor(node, path);

        visitNestedGraphNodes(node, 'commands', [...path, 'commands'], visitor);
        visitNestedGraphNodes(node, 'onFalse', [...path, 'onFalse'], visitor);
        visitNestedGraphNodes(node, 'onTrue', [...path, 'onTrue'], visitor);
        visitNestedGraphNodes(node, 'body', [...path, 'body'], visitor);

        const options = readArray(node, 'options');
        for (const [optionIndex, option] of options.entries()) {
            if (!option || typeof option !== 'object') continue;
            const commands = (option as Record<string, unknown>).commands;
            if (!Array.isArray(commands)) continue;
            visitGraphNodes(commands as PluginNode[], [...path, 'options', optionIndex, 'commands'], visitor);
        }
    }
}

function visitNestedGraphNodes(
    node: PluginNode,
    key: string,
    path: ScriptPath,
    visitor: (node: PluginNode, path: ScriptPath) => void,
): void {
    const commands = readArray(node, key);
    if (commands.length === 0) return;
    visitGraphNodes(commands as PluginNode[], path, visitor);
}

function weatherCueLabel(node: PluginNode): string {
    const action = readString(node, 'action', 'start');
    if (action === 'clear') {
        return 'clear all';
    }
    return `${action} ${readString(node, 'id') || readString(node, 'preset', 'rain')}`;
}

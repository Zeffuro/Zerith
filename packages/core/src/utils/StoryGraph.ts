import type {
    BaseCommand,
    StoryGraphAnalysis,
    StoryGraphIssue,
    StoryGraphLabelReference,
    StoryGraphSceneEdge,
} from '../types';

export interface AnalyzeStoryGraphOptions {
    startScene?: string;
}

type CommandWithNestedScripts = {
    body?: BaseCommand[];
    commands?: BaseCommand[];
    label?: string;
    name?: string;
    onFalse?: BaseCommand[];
    onTrue?: BaseCommand[];
    options?: Array<{
        commands?: BaseCommand[];
    }>;
    to?: string;
} & BaseCommand;

export function analyzeStoryGraph(
    scenes: Record<string, BaseCommand[]>,
    options: AnalyzeStoryGraphOptions = {},
): StoryGraphAnalysis {
    const labelsByScene: Record<string, string[]> = {};
    const labelReferences: StoryGraphLabelReference[] = [];
    const sceneEdges: StoryGraphSceneEdge[] = [];
    const issues: StoryGraphIssue[] = [];

    for (const [sceneName, commands] of Object.entries(scenes)) {
        const labels = new Map<string, number[]>();
        labelsByScene[sceneName] = [];

        visitCommands(commands, [], (command, path) => {
            const flowCommand = command as CommandWithNestedScripts;

            if (flowCommand.type === 'label' && typeof flowCommand.name === 'string' && flowCommand.name.trim()) {
                const label = flowCommand.name;
                if (labels.has(label)) {
                    issues.push({
                        code: 'duplicate_label',
                        label,
                        message: `Scene '${sceneName}' defines label '${label}' more than once.`,
                        path,
                        sceneName,
                    });
                    return;
                }

                labels.set(label, path);
                labelsByScene[sceneName].push(label);
                return;
            }

            if (flowCommand.type === 'goto' && typeof flowCommand.label === 'string' && flowCommand.label.trim()) {
                labelReferences.push({
                    label: flowCommand.label,
                    path,
                    sceneName,
                });
                return;
            }

            if (flowCommand.type === 'jump' && typeof flowCommand.to === 'string' && flowCommand.to.trim()) {
                sceneEdges.push({
                    fromScene: sceneName,
                    path,
                    targetScene: flowCommand.to,
                    type: 'jump',
                });
            }
        });

        labelsByScene[sceneName] = labelsByScene[sceneName].toSorted();
    }

    issues.push(
        ...validateLabelReferences(labelReferences, labelsByScene),
        ...validateSceneEdges(sceneEdges, scenes),
    );

    const startScene = options.startScene ?? Object.keys(scenes)[0];
    const reachableScenes = collectReachableScenes(sceneEdges, scenes, startScene);
    const unreachableScenes = Object.keys(scenes)
        .filter((sceneName) => !reachableScenes.includes(sceneName))
        .toSorted();

    if (startScene && !(startScene in scenes)) {
        issues.push({
            code: 'missing_start_scene',
            message: `Start scene '${startScene}' is not defined.`,
            targetScene: startScene,
        });
    }

    for (const sceneName of unreachableScenes) {
        issues.push({
            code: 'unreachable_scene',
            message: `Scene '${sceneName}' is not reachable from '${startScene ?? 'the first scene'}'.`,
            sceneName,
        });
    }

    return {
        issues,
        labelReferences,
        labelsByScene,
        reachableScenes,
        sceneEdges,
        unreachableScenes,
    };
}

function collectReachableScenes(
    edges: StoryGraphSceneEdge[],
    scenes: Record<string, BaseCommand[]>,
    startScene: string | undefined,
): string[] {
    if (!startScene || !(startScene in scenes)) return [];

    const seen = new Set<string>();
    const pending = [startScene];

    while (pending.length > 0) {
        const sceneName = pending.shift();
        if (!sceneName || seen.has(sceneName)) continue;

        seen.add(sceneName);

        for (const edge of edges) {
            if (edge.fromScene !== sceneName || !(edge.targetScene in scenes)) continue;
            pending.push(edge.targetScene);
        }
    }

    return [...seen].toSorted();
}

function validateLabelReferences(
    references: StoryGraphLabelReference[],
    labelsByScene: Record<string, string[]>,
): StoryGraphIssue[] {
    const issues: StoryGraphIssue[] = [];

    for (const reference of references) {
        if (labelsByScene[reference.sceneName]?.includes(reference.label)) continue;

        issues.push({
            code: 'missing_label',
            label: reference.label,
            message: `Scene '${reference.sceneName}' references missing label '${reference.label}'.`,
            path: reference.path,
            sceneName: reference.sceneName,
        });
    }

    return issues;
}

function validateSceneEdges(
    edges: StoryGraphSceneEdge[],
    scenes: Record<string, BaseCommand[]>,
): StoryGraphIssue[] {
    const issues: StoryGraphIssue[] = [];

    for (const edge of edges) {
        if (edge.targetScene in scenes) continue;

        issues.push({
            code: 'missing_scene',
            message: `Scene '${edge.fromScene}' jumps to missing scene '${edge.targetScene}'.`,
            path: edge.path,
            sceneName: edge.fromScene,
            targetScene: edge.targetScene,
        });
    }

    return issues;
}

function visitCommands(
    commands: BaseCommand[],
    basePath: number[],
    visitor: (command: BaseCommand, path: number[]) => void,
): void {
    for (const [index, command] of commands.entries()) {
        const path = [...basePath, index];
        visitor(command, path);

        const nested = command as CommandWithNestedScripts;
        visitNestedCommands(nested.commands, [...path, 0], visitor);
        visitNestedCommands(nested.onFalse, [...path, 1], visitor);
        visitNestedCommands(nested.onTrue, [...path, 2], visitor);
        visitNestedCommands(nested.body, [...path, 3], visitor);

        if (Array.isArray(nested.options)) {
            for (const [optionIndex, option] of nested.options.entries()) {
                visitNestedCommands(option.commands, [...path, 4, optionIndex], visitor);
            }
        }
    }
}

function visitNestedCommands(
    commands: BaseCommand[] | undefined,
    path: number[],
    visitor: (command: BaseCommand, path: number[]) => void,
): void {
    if (!commands) return;
    visitCommands(commands, path, visitor);
}

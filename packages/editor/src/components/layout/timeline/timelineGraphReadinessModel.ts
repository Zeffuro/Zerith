import type { SceneComposerGraphSummary } from './sceneComposerModel';

export type TimelineGraphReadinessCurrentGraph = {
    calls: number;
    exits: number;
    issueSummary: string;
    labels: number;
    sceneName: string;
};

export type TimelineGraphReadinessReport = {
    blocked: number;
    currentGraph: TimelineGraphReadinessCurrentGraph;
    limited: number;
    ready: number;
    requirements: TimelineGraphReadinessRequirement[];
    status: TimelineGraphReadinessStatus;
};

export type TimelineGraphReadinessRequirement = {
    detail: string;
    id: TimelineGraphReadinessRequirementId;
    label: string;
    status: TimelineGraphReadinessStatus;
    summary: string;
};

export type TimelineGraphReadinessRequirementId =
    | 'guardedRepairActions'
    | 'largeGraphErgonomics'
    | 'layoutPersistence'
    | 'openProjectSmokeCoverage'
    | 'sourceNavigation'
    | 'spatialCanvas'
    | 'timelineOverviewGraph';

export type TimelineGraphReadinessStatus = 'blocked' | 'limited' | 'ready';

const TIMELINE_GRAPH_REQUIREMENTS: readonly TimelineGraphReadinessRequirement[] = [
    {
        detail: 'The Timeline overview summarizes labels, gotos, jumps, calls, and missing target counts without taking over the editor.',
        id: 'timelineOverviewGraph',
        label: 'Timeline overview graph',
        status: 'ready',
        summary: 'Scene-level graph signals are available behind the Overview disclosure.',
    },
    {
        detail: 'Missing labels, scenes, and macros route through explicit creation actions instead of implicit project writes.',
        id: 'guardedRepairActions',
        label: 'Guarded repair actions',
        status: 'ready',
        summary: 'Missing graph targets can be created with guarded Timeline actions.',
    },
    {
        detail: 'Graph chips can select label targets or open scene and macro sources while keeping Timeline and JSON navigation aligned.',
        id: 'sourceNavigation',
        label: 'Source navigation',
        status: 'ready',
        summary: 'Graph navigation lands on the same source paths as validation and JSON reveal flows.',
    },
    {
        detail: 'Safe first-party fixtures cover Overview disclosure, JSON reveal behavior, and guarded missing-scene creation.',
        id: 'openProjectSmokeCoverage',
        label: 'Open-project smoke coverage',
        status: 'ready',
        summary: 'Classic VN starter and example-game smoke tests cover the current graph workflow.',
    },
    {
        detail: 'The current chip list is capped and readable, but it is still a compact overview rather than a route-map workspace.',
        id: 'largeGraphErgonomics',
        label: 'Large graph ergonomics',
        status: 'limited',
        summary: 'Large projects still need interaction and density rules before a canvas rewrite.',
    },
    {
        detail: 'There is no pan/zoom canvas, spatial node layout, edge routing, keyboard traversal model, or render-performance policy yet.',
        id: 'spatialCanvas',
        label: 'Full graph canvas',
        status: 'blocked',
        summary: 'Do not start the graph-canvas rewrite until the interaction model is designed.',
    },
    {
        detail: 'Project data does not store graph node positions, grouping, saved filters, or viewport state.',
        id: 'layoutPersistence',
        label: 'Layout persistence',
        status: 'blocked',
        summary: 'Canvas layout state needs a schema plan before it becomes project metadata.',
    },
];

export function createTimelineGraphReadinessReport(
    graph: SceneComposerGraphSummary,
): TimelineGraphReadinessReport {
    const requirements = TIMELINE_GRAPH_REQUIREMENTS.map((requirement) => ({ ...requirement }));
    const ready = requirements.filter((requirement) => requirement.status === 'ready').length;
    const limited = requirements.filter((requirement) => requirement.status === 'limited').length;
    const blocked = requirements.filter((requirement) => requirement.status === 'blocked').length;

    return {
        blocked,
        currentGraph: {
            calls: graph.calls.length,
            exits: graph.gotos.length + graph.jumps.length,
            issueSummary: graph.missingTargets > 0
                ? `${graph.missingTargets} missing target${graph.missingTargets === 1 ? '' : 's'} in the current scene.`
                : 'Current scene graph is connected.',
            labels: graph.labels.length,
            sceneName: graph.currentSceneName ?? 'unmapped',
        },
        limited,
        ready,
        requirements,
        status: blocked > 0 ? 'blocked' : (limited > 0 ? 'limited' : 'ready'),
    };
}

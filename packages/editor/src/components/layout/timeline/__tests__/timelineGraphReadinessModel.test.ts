import { describe, expect, it } from 'vitest';

import type { SceneComposerGraphSummary } from '../sceneComposerModel';

import { createTimelineGraphReadinessReport } from '../timelineGraphReadinessModel';

describe('timelineGraphReadinessModel', () => {
    it('keeps the full graph canvas blocked while reporting ready Timeline graph foundations', () => {
        const report = createTimelineGraphReadinessReport(createGraphSummary({
            calls: 1,
            exits: 2,
            labels: 3,
            missingTargets: 0,
            sceneName: 'intro',
        }));

        expect(report.status).toBe('blocked');
        expect(report.ready).toBe(4);
        expect(report.limited).toBe(1);
        expect(report.blocked).toBe(2);
        expect(report.currentGraph).toEqual({
            calls: 1,
            exits: 2,
            issueSummary: 'Current scene graph is connected.',
            labels: 3,
            sceneName: 'intro',
        });
        expect(report.requirements.map((requirement) => [requirement.id, requirement.status])).toEqual([
            ['timelineOverviewGraph', 'ready'],
            ['guardedRepairActions', 'ready'],
            ['sourceNavigation', 'ready'],
            ['openProjectSmokeCoverage', 'ready'],
            ['largeGraphErgonomics', 'limited'],
            ['spatialCanvas', 'blocked'],
            ['layoutPersistence', 'blocked'],
        ]);
    });

    it('summarizes missing current-scene targets without unblocking the canvas lane', () => {
        const report = createTimelineGraphReadinessReport(createGraphSummary({
            calls: 2,
            exits: 1,
            labels: 0,
            missingTargets: 2,
        }));

        expect(report.status).toBe('blocked');
        expect(report.currentGraph).toEqual({
            calls: 2,
            exits: 1,
            issueSummary: '2 missing targets in the current scene.',
            labels: 0,
            sceneName: 'unmapped',
        });
    });
});

function createGraphSummary({
    calls,
    exits,
    labels,
    missingTargets,
    sceneName,
}: {
    calls: number;
    exits: number;
    labels: number;
    missingTargets: number;
    sceneName?: string;
}): SceneComposerGraphSummary {
    return {
        calls: Array.from({ length: calls }, (_, index) => ({
            macroName: `macro_${index}`,
            path: [index],
            status: 'ok',
        })),
        currentSceneName: sceneName,
        gotos: Array.from({ length: Math.floor(exits / 2) }, (_, index) => ({
            label: `label_${index}`,
            path: [index],
            status: 'ok',
            targetPath: [index + 1],
        })),
        jumps: Array.from({ length: Math.ceil(exits / 2) }, (_, index) => ({
            path: [index],
            status: 'ok',
            targetScene: `scene_${index}`,
        })),
        labels: Array.from({ length: labels }, (_, index) => ({
            name: `label_${index}`,
            path: [index],
        })),
        missingTargets,
    };
}

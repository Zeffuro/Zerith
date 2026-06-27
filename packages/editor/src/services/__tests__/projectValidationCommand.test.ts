import { describe, expect, it, vi } from 'vitest';

import type { ProjectValidationReport } from '../projectValidationReport';

import {
    executeProjectValidationCommand,
    formatProjectValidationReport,
} from '../projectValidationCommand';

function createReport(overrides: Partial<ProjectValidationReport> = {}): ProjectValidationReport {
    return {
        backlog: {
            duplicateLineIds: [],
            entries: [],
            hiddenCount: 0,
            missingLineIds: [],
            visibleCount: 1,
            voicedCount: 0,
        },
        graph: {
            issues: [],
            labelReferences: [],
            labelsByScene: {},
            reachableScenes: ['intro'],
            sceneEdges: [],
            unreachableScenes: [],
        },
        localization: {
            localeReports: [],
            referenceCount: 0,
            references: [],
        },
        manifest: {},
        manifestPath: '/project/game.json',
        projectPath: '/project',
        scenes: [
            {
                commands: [],
                sceneName: 'intro',
            },
        ],
        ...overrides,
    };
}

describe('projectValidationCommand', () => {
    it('warns when no project is open', async () => {
        const log = vi.fn();

        const result = await executeProjectValidationCommand(undefined, {
            buildReport: vi.fn(),
            log,
        });

        expect(result).toEqual({ status: 'no-project' });
        expect(log).toHaveBeenCalledWith('editor', 'warn', 'Project validation requires an open project.');
    });

    it('logs a clean validation report', async () => {
        const log = vi.fn();
        const report = createReport();

        const result = await executeProjectValidationCommand('/project', {
            buildReport: vi.fn(() => Promise.resolve(report)),
            log,
        });

        expect(result).toEqual({ report, status: 'ok' });
        expect(log).toHaveBeenCalledWith('editor', 'info', expect.stringContaining('Project validation: clean'));
    });

    it('logs validation issues as warnings', async () => {
        const log = vi.fn();
        const report = createReport({
            graph: {
                issues: [
                    {
                        code: 'missing_scene',
                        message: "Scene 'intro' jumps to missing scene 'ending'.",
                        path: [1],
                        sceneName: 'intro',
                        targetScene: 'ending',
                    },
                ],
                labelReferences: [],
                labelsByScene: {},
                reachableScenes: ['intro'],
                sceneEdges: [],
                unreachableScenes: [],
            },
        });

        const result = await executeProjectValidationCommand('/project', {
            buildReport: vi.fn(() => Promise.resolve(report)),
            log,
        });

        expect(result).toEqual({ report, status: 'issues' });
        expect(log).toHaveBeenCalledWith('editor', 'warn', expect.stringContaining('Graph missing_scene'));
    });

    it('formats backlog readiness details', () => {
        const report = createReport({
            backlog: {
                duplicateLineIds: [
                    {
                        entries: [
                            {
                                backlogVisibility: 'show',
                                lineId: 'intro.001',
                                namespace: 'scene.intro',
                                path: [0],
                                sceneName: 'intro',
                                speaker: 'Ari',
                                tags: [],
                                text: 'One.',
                            },
                            {
                                backlogVisibility: 'show',
                                lineId: 'intro.001',
                                namespace: 'scene.intro',
                                path: [1],
                                sceneName: 'intro',
                                speaker: 'Ari',
                                tags: [],
                                text: 'Two.',
                            },
                        ],
                        lineId: 'intro.001',
                        namespace: 'scene.intro',
                    },
                ],
                entries: [],
                hiddenCount: 0,
                missingLineIds: [
                    {
                        backlogVisibility: 'show',
                        path: [2],
                        sceneName: 'intro',
                        speaker: 'Ari',
                        tags: [],
                        text: 'Missing.',
                    },
                ],
                visibleCount: 3,
                voicedCount: 0,
            },
        });

        expect(formatProjectValidationReport(report)).toContain('Backlog duplicate lineId scene.intro:intro.001');
        expect(formatProjectValidationReport(report)).toContain('Backlog line missing lineId: intro @ 2');
    });
});

import { describe, expect, it } from 'vitest';

import type { ProjectValidationReport } from '../../../services/projectValidationReport';

import {
    buildProjectValidationPanelRows,
    summarizeProjectValidationPanelReport,
} from '../projectValidationPanelModel';

describe('projectValidationPanelModel', () => {
    it('builds validation rows with scene and locale source targets', () => {
        const report = createReport();

        const rows = buildProjectValidationPanelRows(report);

        expect(rows.map((row) => row.id)).toEqual([
            'graph-missing_scene-0',
            'graph-unreachable_scene-1',
            'locale-missing-en-0',
            'locale-unused-en-0',
            'backlog-missing-0',
            'backlog-duplicate-0',
        ]);
        expect(rows[0]?.source).toEqual({ filePath: '/project/scenes/intro.json', path: [3] });
        expect(rows[2]?.actions).toEqual([{
            kind: 'localization',
            label: 'Locale',
            query: 'scene.intro:intro.duplicate',
            title: 'Open in localization editor',
        }]);
        expect(rows[3]?.source).toEqual({
            filePath: '/project/locales/en.json',
            jsonPath: ['namespaces', 'scene.intro', 'unused'],
        });
        expect(rows[4]?.source).toEqual({ filePath: '/project/scenes/intro.json', path: [1] });
    });

    it('summarizes report issue counts for panel chips', () => {
        const summary = summarizeProjectValidationPanelReport(createReport());

        expect(summary).toEqual({
            duplicateLineIds: 1,
            graphIssues: 2,
            invalidLocaleBundles: 0,
            issueRows: 6,
            missingLineIds: 1,
            missingLocaleEntries: 1,
            scenes: 2,
            unusedLocaleEntries: 1,
        });
    });
});

function createReport(): ProjectValidationReport {
    return {
        backlog: {
            duplicateLineIds: [{
                entries: [{
                    backlogVisibility: 'show',
                    lineId: 'intro.duplicate',
                    namespace: 'scene.intro',
                    path: [2],
                    sceneName: 'intro',
                    speaker: 'Ari',
                    tags: [],
                    text: 'Duplicate.',
                }],
                lineId: 'intro.duplicate',
                namespace: 'scene.intro',
            }],
            entries: [],
            hiddenCount: 0,
            missingLineIds: [{
                backlogVisibility: 'show',
                namespace: 'scene.intro',
                path: [1],
                sceneName: 'intro',
                speaker: 'Ari',
                tags: [],
                text: 'Needs an ID.',
            }],
            visibleCount: 2,
            voicedCount: 0,
        },
        graph: {
            issues: [
                {
                    code: 'missing_scene',
                    message: 'Missing scene.',
                    path: [3],
                    sceneName: 'intro',
                    targetScene: 'missing',
                },
                {
                    code: 'unreachable_scene',
                    message: 'Unreachable scene.',
                    sceneName: 'orphan',
                },
            ],
            labelReferences: [],
            labelsByScene: {},
            reachableScenes: ['intro'],
            sceneEdges: [],
            unreachableScenes: ['orphan'],
        },
        localization: {
            localeReports: [{
                bundle: {
                    locale: 'en',
                    namespaces: {},
                },
                locale: 'en',
                missing: [{
                    lineId: 'intro.duplicate',
                    namespace: 'scene.intro',
                    path: [2],
                    sceneName: 'intro',
                    text: 'Duplicate.',
                }],
                path: '/project/locales/en.json',
                status: 'ok',
                unused: [{ lineId: 'unused', namespace: 'scene.intro' }],
            }],
            referenceCount: 1,
            references: [],
        },
        manifest: {
            scenes: {},
        },
        manifestPath: '/project/game.json',
        projectPath: '/project',
        scenes: [
            {
                commands: [],
                path: '/project/scenes/intro.json',
                sceneName: 'intro',
            },
            {
                commands: [],
                path: '/project/scenes/orphan.json',
                sceneName: 'orphan',
            },
        ],
    };
}

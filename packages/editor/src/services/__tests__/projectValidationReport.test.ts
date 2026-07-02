import { describe, expect, it } from 'vitest';

import { createProjectValidationReport } from '../projectValidationReport';

describe('projectValidationReport', () => {
    it('reports graph, localization, and backlog status issues', async () => {
        const files = new Map<string, string>([
            ['/project/game.json', JSON.stringify({
                localization: {
                    defaultLocale: 'en',
                    locales: {
                        en: '/locales/en.json',
                    },
                },
                scenes: {
                    intro: '/scenes/intro.json',
                    orphan: '/scenes/orphan.json',
                },
                startScene: 'intro',
            })],
            ['/project/locales/en.json', JSON.stringify({
                $schema: 'zerith/locale',
                locale: 'en',
                namespaces: {
                    'scene.intro': {
                        'intro.001': 'Localized.',
                        'intro.unused': 'Unused.',
                    },
                },
            })],
            ['/project/scenes/intro.json', JSON.stringify({
                $schema: 'zerith/scene',
                commands: [
                    {
                        lineId: 'intro.001',
                        speaker: 'Ari',
                        text: 'Localized.',
                        type: 'dialogue',
                    },
                    {
                        speaker: 'Ari',
                        text: 'Needs an ID.',
                        type: 'dialogue',
                    },
                    {
                        lineId: 'intro.duplicate',
                        speaker: 'Ari',
                        text: 'First duplicate.',
                        type: 'dialogue',
                    },
                    {
                        lineId: 'intro.duplicate',
                        speaker: 'Ari',
                        text: 'Second duplicate.',
                        type: 'dialogue',
                    },
                    {
                        to: 'missing_scene',
                        type: 'jump',
                    },
                ],
                localeNamespace: 'scene.intro',
            })],
            ['/project/scenes/orphan.json', JSON.stringify([])],
        ]);

        const report = await createProjectValidationReport('/project', {
            readTextFile: (path) => {
                const value = files.get(path);
                if (value === undefined) throw new Error(`Missing file: ${path}`);
                return Promise.resolve(value);
            },
        });

        expect(report.graph.issues.map((issue) => issue.code)).toEqual([
            'missing_scene',
            'unreachable_scene',
        ]);
        expect(report.localization.referenceCount).toBe(3);
        expect(report.localization.localeReports[0]).toMatchObject({
            locale: 'en',
            status: 'ok',
        });
        expect(report.localization.localeReports[0]?.status === 'ok'
            ? report.localization.localeReports[0].missing.map((entry) => entry.lineId)
            : []).toEqual(['intro.duplicate', 'intro.duplicate']);
        expect(report.localization.localeReports[0]?.status === 'ok'
            ? report.localization.localeReports[0].unused
            : []).toEqual([{ lineId: 'intro.unused', namespace: 'scene.intro' }]);
        expect(report.backlog.missingLineIds).toHaveLength(1);
        expect(report.backlog.duplicateLineIds).toMatchObject([
            {
                lineId: 'intro.duplicate',
                namespace: 'scene.intro',
            },
        ]);
    });

    it('returns a clean report for reachable localized content', async () => {
        const files = new Map<string, string>([
            ['/project/game.json', JSON.stringify({
                localization: {
                    locales: {
                        en: '/locales/en.json',
                    },
                },
                scenes: {
                    intro: '/scenes/intro.json',
                },
                startScene: 'intro',
            })],
            ['/project/locales/en.json', JSON.stringify({
                locale: 'en',
                namespaces: {
                    'scene.intro': {
                        'intro.001': 'Ready.',
                    },
                },
            })],
            ['/project/scenes/intro.json', JSON.stringify({
                commands: [
                    {
                        lineId: 'intro.001',
                        speaker: 'Ari',
                        text: 'Ready.',
                        type: 'dialogue',
                    },
                ],
                localeNamespace: 'scene.intro',
            })],
        ]);

        const report = await createProjectValidationReport('/project', {
            readTextFile: (path) => Promise.resolve(files.get(path) ?? ''),
        });
        const localeReport = report.localization.localeReports[0];

        expect(report.graph.issues).toEqual([]);
        expect(localeReport?.status === 'ok' ? localeReport.missing : []).toEqual([]);
        expect(localeReport?.status === 'ok' ? localeReport.unused : []).toEqual([]);
        expect(report.backlog.missingLineIds).toEqual([]);
        expect(report.backlog.duplicateLineIds).toEqual([]);
    });
});

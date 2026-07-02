import type { LocaleBundle, Script } from '@zeffuro/zerith-core';

import { describe, expect, it } from 'vitest';

import {
    buildLocalizationPanelRows,
    createLocaleBundleFromRows,
    createLocalizationPanelSummary,
    createLocalizationRoundTripDocument,
    createMissingLocaleEntryDrafts,
    createTranslatorImportDrafts,
    filterLocalizationPanelRows,
    getLocaleManifestPath,
    getLocalizationRoundTripFileName,
    pruneUnusedLocaleBundleEntries,
    toLocalizationEntryKey,
    updateLocaleBundleEntries,
} from '../localizationPanelModel';

describe('localizationPanelModel', () => {
    it('builds editable rows from scene dialogue references', () => {
        const scenes: Record<string, Script> = {
            intro: [
                { lineId: 'intro.001', speaker: 'aria', text: 'Hello.', type: 'dialogue' },
                { lineId: 'intro.001', speaker: 'aria', text: 'Hello.', type: 'dialogue' },
                {
                    options: [{
                        label: 'Go',
                        labelId: 'intro.choice.go.label',
                    }],
                    type: 'choice',
                },
            ],
        };
        const bundle: LocaleBundle = {
            locale: 'fr',
            namespaces: {
                'scene.intro': {
                    'intro.001': 'Bonjour.',
                    'intro.choice.go.label': 'Aller',
                    unused: 'Unused.',
                },
            },
        };

        const rows = buildLocalizationPanelRows({
            sceneNamespaces: { intro: 'scene.intro' },
            scenePaths: { intro: '/project/scenes/intro.json' },
            scenes,
        }, bundle);

        expect(rows).toHaveLength(3);
        expect(rows[0]).toMatchObject({
            issueSeverity: 'none',
            kind: 'dialogue',
            lineId: 'intro.001',
            namespace: 'scene.intro',
            sourceText: 'Hello.',
            status: 'translated',
            value: 'Bonjour.',
        });
        expect(rows[0].locations).toHaveLength(2);
        expect(rows[1]).toMatchObject({
            issueSeverity: 'none',
            kind: 'choice-option',
            lineId: 'intro.choice.go.label',
            namespace: 'scene.intro',
            sourceText: 'Go',
            status: 'translated',
            value: 'Aller',
        });
        expect(rows[2]).toMatchObject({
            issueSeverity: 'warning',
            kind: 'unused',
            lineId: 'unused',
            namespace: 'scene.intro',
            status: 'unused',
            value: 'Unused.',
        });
    });

    it('creates and updates sorted locale bundles', () => {
        const rows = buildLocalizationPanelRows({
            sceneNamespaces: {},
            scenePaths: {},
            scenes: {
                intro: [{ lineId: 'intro.001', speaker: 'aria', text: 'Hello.', type: 'dialogue' }],
            },
        });
        const bundle = createLocaleBundleFromRows('fr', rows);
        const key = toLocalizationEntryKey('scene.intro', 'intro.001');
        const updated = updateLocaleBundleEntries(bundle, { [key]: 'Bonjour.' });

        expect(getLocaleManifestPath('fr-FR')).toBe('/locales/fr-fr.json');
        expect(updated.namespaces['scene.intro']['intro.001']).toBe('Bonjour.');
        expect(updated).toMatchObject({
            $schema: 'zerith/locale',
            locale: 'fr',
            schemaVersion: 2,
        });
    });

    it('summarizes, filters, fills, and prunes localization rows deterministically', () => {
        const scenes: Record<string, Script> = {
            intro: [
                { lineId: 'intro.001', speaker: 'aria', text: 'Hello.', type: 'dialogue' },
                { lineId: 'intro.002', speaker: 'aria', text: 'Same.', type: 'dialogue' },
            ],
            outro: [
                { lineId: 'outro.001', speaker: 'aria', text: 'Bye.', type: 'dialogue' },
            ],
        };
        const bundle: LocaleBundle = {
            locale: 'fr',
            namespaces: {
                'scene.intro': {
                    'intro.002': 'Same.',
                    unused: 'Unused.',
                },
                'scene.outro': {
                    'outro.001': 'Salut.',
                },
            },
        };
        const rows = buildLocalizationPanelRows({
            sceneNamespaces: {},
            scenePaths: {},
            scenes,
        }, bundle);

        expect(createLocalizationPanelSummary(rows)).toEqual({
            missing: 1,
            namespaces: ['scene.intro', 'scene.outro'],
            same: 1,
            total: 4,
            translated: 1,
            unused: 1,
        });
        expect(filterLocalizationPanelRows(rows, { status: 'missing' }).map((row) => row.lineId)).toEqual(['intro.001']);
        expect(filterLocalizationPanelRows(rows, { issueSeverity: 'warning' }).map((row) => row.lineId)).toEqual(['intro.002', 'unused']);
        expect(filterLocalizationPanelRows(rows, { namespace: 'scene.outro' }).map((row) => row.lineId)).toEqual(['outro.001']);
        expect(createMissingLocaleEntryDrafts(rows)).toEqual({
            'scene.intro:intro.001': 'Hello.',
        });
        expect(pruneUnusedLocaleBundleEntries(bundle, rows)).toEqual({
            locale: 'fr',
            namespaces: {
                'scene.intro': {
                    'intro.002': 'Same.',
                },
                'scene.outro': {
                    'outro.001': 'Salut.',
                },
            },
        });
    });

    it('creates and imports deterministic translator round-trip documents', () => {
        const rows = buildLocalizationPanelRows({
            sceneNamespaces: {},
            scenePaths: {},
            scenes: {
                intro: [
                    { lineId: 'intro.002', speaker: 'aria', text: 'Second.', type: 'dialogue' },
                    { lineId: 'intro.001', speaker: 'aria', text: 'First.', type: 'dialogue' },
                ],
            },
        }, {
            locale: 'fr-FR',
            namespaces: {
                'scene.intro': {
                    'intro.001': 'Premier.',
                    'intro.002': 'Deuxieme.',
                },
            },
        });
        const document = createLocalizationRoundTripDocument('fr-FR', rows, {
            'scene.intro:intro.002': 'Deuxieme draft.',
        });

        expect(getLocalizationRoundTripFileName('fr-FR')).toBe('fr-fr.translator.json');
        expect(document).toEqual({
            entries: [
                {
                    kind: 'dialogue',
                    lineId: 'intro.001',
                    namespace: 'scene.intro',
                    sourceText: 'First.',
                    status: 'translated',
                    value: 'Premier.',
                },
                {
                    kind: 'dialogue',
                    lineId: 'intro.002',
                    namespace: 'scene.intro',
                    sourceText: 'Second.',
                    status: 'translated',
                    value: 'Deuxieme draft.',
                },
            ],
            locale: 'fr-FR',
            schemaVersion: 1,
            type: 'zerith.localizationRoundTrip',
        });
        expect(createTranslatorImportDrafts({
            entries: [
                { lineId: 'intro.001', namespace: 'scene.intro', value: 'Premier import.' },
            ],
            locale: 'fr-FR',
        })).toEqual({
            locale: 'fr-FR',
            updates: {
                'scene.intro:intro.001': 'Premier import.',
            },
        });
    });
});

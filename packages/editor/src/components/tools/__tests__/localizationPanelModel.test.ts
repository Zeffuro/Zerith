import type { LocaleBundle, Script } from 'core';

import { describe, expect, it } from 'vitest';

import {
    buildLocalizationPanelRows,
    createLocaleBundleFromRows,
    getLocaleManifestPath,
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
                },
            },
        };

        const rows = buildLocalizationPanelRows({
            sceneNamespaces: { intro: 'scene.intro' },
            scenePaths: { intro: '/project/scenes/intro.json' },
            scenes,
        }, bundle);

        expect(rows).toHaveLength(2);
        expect(rows[0]).toMatchObject({
            kind: 'dialogue',
            lineId: 'intro.001',
            namespace: 'scene.intro',
            sourceText: 'Hello.',
            status: 'translated',
            value: 'Bonjour.',
        });
        expect(rows[0].locations).toHaveLength(2);
        expect(rows[1]).toMatchObject({
            kind: 'choice-option',
            lineId: 'intro.choice.go.label',
            namespace: 'scene.intro',
            sourceText: 'Go',
            status: 'translated',
            value: 'Aller',
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
});

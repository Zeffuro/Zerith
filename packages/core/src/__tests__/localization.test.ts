import { describe, expect, it } from 'vitest';

import type { BaseCommand, LocaleBundle } from '../types';

import { LocaleBundleSchema, parseLocaleBundle } from '../schemas';
import {
    collectDialogueLocalizationReferences,
    collectTextLocalizationReferences,
    resolveLocalizedText,
    validateLocalizationCoverage,
} from '../utils/Localization';

describe('localization', () => {
    it('parses locale bundles and reports useful errors', () => {
        const parsed = LocaleBundleSchema.parse({
            $schema: 'zerith/locale',
            locale: 'en',
            namespaces: {
                'scene.intro': {
                    'intro.line.001': 'Hello.',
                },
            },
            schemaVersion: 2,
        });

        expect(parsed.locale).toBe('en');
        expect(parsed.namespaces['scene.intro']?.['intro.line.001']).toBe('Hello.');

        const invalid = parseLocaleBundle({
            locale: '',
            namespaces: {},
        });

        expect(invalid).toMatchObject({
            success: false,
        });
        if (!invalid.success) {
            expect(invalid.error).toContain('locale');
        }
    });

    it('collects dialogue line IDs from nested command scripts', () => {
        const script: BaseCommand[] = [
            {
                lineId: 'intro.line.001',
                speaker: 'narrator',
                text: 'Opening.',
                type: 'dialogue',
            },
            {
                options: [
                    {
                        commands: [
                            {
                                lineId: 'intro.branch.001',
                                speaker: 'narrator',
                                text: 'Branch.',
                                type: 'dialogue',
                            },
                        ],
                        label: 'Branch',
                    },
                ],
                type: 'choice',
            },
            {
                onTrue: [
                    {
                        commands: [
                            {
                                lineId: 'intro.block.001',
                                speaker: 'narrator',
                                text: 'Block.',
                                type: 'dialogue',
                            },
                        ],
                        type: 'block',
                    },
                ],
                type: 'if',
            },
        ];

        const references = collectDialogueLocalizationReferences(script, { namespace: 'scene.intro' });

        expect(references.map((reference) => reference.lineId)).toEqual([
            'intro.line.001',
            'intro.branch.001',
            'intro.block.001',
        ]);
        expect(references.map((reference) => reference.namespace)).toEqual([
            'scene.intro',
            'scene.intro',
            'scene.intro',
        ]);
    });

    it('collects choice option label IDs as localizable text references', () => {
        const script: BaseCommand[] = [
            {
                id: 'intro.choice.ready',
                options: [
                    {
                        id: 'intro.choice.ready.yes',
                        label: 'Ready',
                        labelId: 'intro.choice.ready.yes.label',
                    },
                    {
                        label: 'No localized ID',
                    },
                ],
                type: 'choice',
            },
        ];

        const references = collectTextLocalizationReferences(script, { namespace: 'scene.intro' });

        expect(references).toEqual([
            {
                choiceId: 'intro.choice.ready',
                kind: 'choice-option',
                lineId: 'intro.choice.ready.yes.label',
                namespace: 'scene.intro',
                optionId: 'intro.choice.ready.yes',
                path: [0],
                text: 'Ready',
            },
        ]);
        expect(collectDialogueLocalizationReferences(script, { namespace: 'scene.intro' })).toEqual([]);
    });

    it('validates localization coverage and resolves fallback text', () => {
        const bundle: LocaleBundle = {
            locale: 'en',
            namespaces: {
                'scene.intro': {
                    'intro.line.001': 'Localized opening.',
                    'intro.unused.001': 'Unused.',
                },
            },
            schemaVersion: 2,
        };
        const references = [
            {
                lineId: 'intro.line.001',
                namespace: 'scene.intro',
                path: [0],
                text: 'Opening.',
            },
            {
                lineId: 'intro.missing.001',
                namespace: 'scene.intro',
                path: [1],
                text: 'Missing.',
            },
        ];

        expect(resolveLocalizedText(bundle, 'intro.line.001', { namespace: 'scene.intro' }))
            .toBe('Localized opening.');
        expect(resolveLocalizedText(bundle, 'intro.missing.001', {
            fallback: 'Missing.',
            namespace: 'scene.intro',
        })).toBe('Missing.');

        const coverage = validateLocalizationCoverage(bundle, references);

        expect(coverage.missing).toEqual([references[1]]);
        expect(coverage.unused).toEqual([
            {
                lineId: 'intro.unused.001',
                namespace: 'scene.intro',
            },
        ]);
    });
});

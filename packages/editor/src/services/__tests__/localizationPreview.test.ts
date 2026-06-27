import type { LocaleBundle, Script } from 'core';

import { describe, expect, it } from 'vitest';

import {
    localizeSceneMapForPreview,
    localizeScriptForPreview,
    resolvePreviewLocaleBundle,
    SOURCE_PREVIEW_LOCALE,
} from '../localizationPreview';

const bundle: LocaleBundle = {
    locale: 'fr',
    namespaces: {
        'scene.intro': {
            'intro.001': 'Bonjour.',
            'intro.branch': 'Choix.',
            'intro.pick.label': 'Choisir',
        },
        'scene.next': {
            'next.001': 'Suivant.',
        },
    },
};

describe('localizationPreview', () => {
    it('localizes nested dialogue commands without mutating the source script', () => {
        const script: Script = [
            { lineId: 'intro.001', speaker: 'aria', text: 'Hello.', type: 'dialogue' },
            {
                options: [{
                    commands: [
                        { lineId: 'intro.branch', speaker: 'aria', text: 'Choice.', type: 'dialogue' },
                    ],
                    label: 'Pick',
                    labelId: 'intro.pick.label',
                }],
                type: 'choice',
            },
        ];

        const localized = localizeScriptForPreview(script, bundle, 'scene.intro');

        expect(localized[0]).toMatchObject({ text: 'Bonjour.' });
        expect(((localized[1].options as Array<{ label: string }>)[0])).toMatchObject({ label: 'Choisir' });
        expect(((localized[1].options as Array<{ commands: Script }>)[0].commands[0])).toMatchObject({ text: 'Choix.' });
        expect(script[0]).toMatchObject({ text: 'Hello.' });
    });

    it('localizes scenes with their own namespaces', () => {
        const scenes = {
            intro: [{ lineId: 'intro.001', speaker: 'aria', text: 'Hello.', type: 'dialogue' }],
            next: [{ lineId: 'next.001', speaker: 'aria', text: 'Next.', type: 'dialogue' }],
        } satisfies Record<string, Script>;

        const localized = localizeSceneMapForPreview(scenes, { next: 'scene.next' }, bundle);

        expect(localized.intro[0]).toMatchObject({ text: 'Bonjour.' });
        expect(localized.next[0]).toMatchObject({ text: 'Suivant.' });
    });

    it('resolves explicit, default, and source-preview locales', () => {
        expect(resolvePreviewLocaleBundle({ fr: bundle }, 'fr')).toEqual({ bundle, locale: 'fr' });
        expect(resolvePreviewLocaleBundle({ fr: bundle }, undefined, 'fr')).toEqual({ bundle, locale: 'fr' });
        expect(resolvePreviewLocaleBundle({ fr: bundle }, SOURCE_PREVIEW_LOCALE, 'fr')).toEqual({
            bundle: undefined,
            locale: undefined,
        });
    });
});

import { describe, expect, it } from 'vitest';

import { createSliceHarness } from '../../../test-utils/createSliceHarness';
import { buildPreviewTheme } from '../themeEditorDraftModel';

describe('themeEditorDraftModel', () => {
    const themes = [
        {
            key: 'classic',
            label: 'Classic',
            vars: {
                '--editor-bg-app': '#1e1e1e',
                '--editor-text-primary': '#ffffff',
            },
        },
        {
            key: 'classic-soft',
            label: 'Classic Soft',
            vars: {
                '--editor-bg-app': '#222222',
                '--editor-text-primary': '#eeeeee',
            },
        },
    ];

    it('uses selected base theme variables for preview', () => {
        const preview = buildPreviewTheme(
            'classic-soft',
            { '--editor-text-primary': '#aaaaaa' },
            themes,
            'custom-night',
            'Custom Night',
        );

        expect(preview.vars['--editor-bg-app']).toBe('#222222');
        expect(preview.vars['--editor-text-primary']).toBe('#aaaaaa');
    });

    it('falls back to classic theme when base key is missing', () => {
        const preview = buildPreviewTheme(undefined, {}, themes, 'custom-night', 'Custom Night');

        expect(preview.vars['--editor-bg-app']).toBe('#1e1e1e');
    });

    it('keeps preview key and default label stable while state updates', () => {
        const harness = createSliceHarness({
            baseThemeKey: 'classic',
            key: undefined as string | undefined,
            label: ' '.repeat(3),
            vars: { '--editor-text-primary': '#ffffff' },
        });

        harness.set((state) => ({
            key: 'custom-preview',
            vars: { ...state.vars, '--editor-text-primary': '#dddddd' },
        }));

        const preview = buildPreviewTheme(
            harness.get().baseThemeKey,
            harness.get().vars,
            themes,
            harness.get().key,
            harness.get().label,
        );

        expect(preview.key).toBe('custom-preview');
        expect(preview.label).toBe('Preview');
        expect(preview.vars['--editor-text-primary']).toBe('#dddddd');
    });
});


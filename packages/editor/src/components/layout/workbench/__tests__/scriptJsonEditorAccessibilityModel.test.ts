import { describe, expect, it } from 'vitest';

import { createScriptJsonEditorAccessibilityOptions } from '../scriptJsonEditorAccessibilityModel';

describe('scriptJsonEditorAccessibilityModel', () => {
    it('preserves current Monaco defaults when comfort options are disabled', () => {
        expect(createScriptJsonEditorAccessibilityOptions({
            codeEditorLargeText: false,
            codeEditorPlainTextComfort: false,
            codeEditorScreenReaderMode: 'auto',
            uiScale: 1,
        })).toEqual({
            accessibilitySupport: 'auto',
            folding: true,
            fontSize: 12,
            lineHeight: 18,
            minimap: { enabled: true },
            renderLineHighlight: 'line',
            wordWrap: 'off',
        });
    });

    it('applies screen-reader, plain-text comfort, and large text settings', () => {
        expect(createScriptJsonEditorAccessibilityOptions({
            codeEditorLargeText: true,
            codeEditorPlainTextComfort: true,
            codeEditorScreenReaderMode: 'on',
            uiScale: 1.25,
        })).toEqual({
            accessibilitySupport: 'on',
            folding: false,
            fontSize: 18,
            lineHeight: 28,
            minimap: { enabled: false },
            renderLineHighlight: 'none',
            wordWrap: 'on',
        });
    });
});

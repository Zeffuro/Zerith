import type * as Monaco from 'monaco-editor';

import type { CodeEditorScreenReaderMode } from '../../../store/settings/SettingsSchema';

export type ScriptJsonEditorAccessibilitySettings = {
    codeEditorLargeText: boolean;
    codeEditorPlainTextComfort: boolean;
    codeEditorScreenReaderMode: CodeEditorScreenReaderMode;
    uiScale: number;
};

export function createScriptJsonEditorAccessibilityOptions({
    codeEditorLargeText,
    codeEditorPlainTextComfort,
    codeEditorScreenReaderMode,
    uiScale,
}: ScriptJsonEditorAccessibilitySettings): Pick<
    Monaco.editor.IStandaloneEditorConstructionOptions,
    'accessibilitySupport' | 'folding' | 'fontSize' | 'lineHeight' | 'minimap' | 'renderLineHighlight' | 'wordWrap'
> {
    const safeScale = Number.isFinite(uiScale) && uiScale > 0 ? uiScale : 1;
    const baseFontSize = codeEditorLargeText ? 14 : 12;
    const baseLineHeight = codeEditorLargeText ? 22 : 18;

    return {
        accessibilitySupport: codeEditorScreenReaderMode,
        folding: !codeEditorPlainTextComfort,
        fontSize: Math.round(baseFontSize * safeScale),
        lineHeight: Math.round(baseLineHeight * safeScale),
        minimap: { enabled: !codeEditorPlainTextComfort },
        renderLineHighlight: codeEditorPlainTextComfort ? 'none' : 'line',
        wordWrap: codeEditorPlainTextComfort ? 'on' : 'off',
    };
}

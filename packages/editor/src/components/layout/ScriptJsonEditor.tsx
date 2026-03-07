import { useEffect, useMemo, useRef, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { useScriptStore } from '../../store/useScriptStore';
import { editorTheme as t } from '../../theme/editorTheme';

export function ScriptJsonEditor({ uiScale }: { uiScale: number }) {
    const rootScript = useScriptStore((s) => s.rootScript);
    const setScript = useScriptStore((s) => s.setScript);

    const initial = useMemo(() => JSON.stringify(rootScript, null, 2), [rootScript]);

    const [value, setValue] = useState(initial);
    const [error, setError] = useState<string | null>(null);

    const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
    const monacoRef = useRef<typeof Monaco | null>(null);

    useEffect(() => {
        setValue(initial);
        setError(null);
    }, [initial]);

    const apply = () => {
        try {
            const parsed = JSON.parse(value);
            if (!Array.isArray(parsed)) {
                setError('Root JSON must be an array.');
                return;
            }
            setScript(parsed);
            setError(null);
        } catch (e: any) {
            setError(e?.message ?? 'Invalid JSON');
        }
    };

    const formatDoc = async () => {
        const editor = editorRef.current;
        if (!editor) return;
        await editor.getAction('editor.action.formatDocument')?.run();
    };

    const onMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;

        monaco.editor.defineTheme('zerith-json-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [],
            colors: {
                'editor.background': '#1e1e1e',
                'editorLineNumber.foreground': '#6b7280',
                'editorLineNumber.activeForeground': '#9ca3af',
                'editorGutter.background': '#1e1e1e',
                'editorCursor.foreground': '#f9fafb',
            },
        });

        monaco.editor.setTheme('zerith-json-dark');
    };

    return (
        <div
            style={{
                height: '100%',
                display: 'grid',
                gridTemplateRows: 'auto 1fr auto',
                gap: `${8 * uiScale}px`,
                padding: `${8 * uiScale}px`,
                background: t.bg.app,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: `${8 * uiScale}px` }}>
                <strong style={{ color: t.text.primary }}>Script JSON</strong>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: `${6 * uiScale}px` }}>
                    <button
                        onClick={formatDoc}
                        style={{
                            background: t.bg.panel,
                            border: `1px solid ${t.border.button}`,
                            color: t.text.normal,
                            borderRadius: t.radius.md,
                            padding: `${5 * uiScale}px ${10 * uiScale}px`,
                            cursor: 'pointer',
                        }}
                    >
                        Format
                    </button>
                    <button
                        onClick={apply}
                        style={{
                            background: t.accent.primary,
                            border: `1px solid ${t.border.primaryBtn}`,
                            color: t.text.primary,
                            borderRadius: t.radius.md,
                            padding: `${5 * uiScale}px ${10 * uiScale}px`,
                            cursor: 'pointer',
                            fontWeight: 700,
                        }}
                    >
                        Apply JSON
                    </button>
                </div>
            </div>

            <div style={{ border: `1px solid ${error ? '#ef4444' : t.border.subtle}`, borderRadius: t.radius.md, overflow: 'hidden' }}>
                <Editor
                    height="100%"
                    defaultLanguage="json"
                    value={value}
                    onChange={(v) => {
                        setValue(v ?? '');
                        setError(null);
                    }}
                    onMount={onMount}
                    options={{
                        fontSize: Math.round(12 * uiScale),
                        minimap: { enabled: true },
                        wordWrap: 'off',
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        formatOnPaste: true,
                        formatOnType: true,
                        tabSize: 2,
                        insertSpaces: true,
                        bracketPairColorization: { enabled: true },
                    }}
                />
            </div>

            <div style={{ minHeight: `${18 * uiScale}px`, color: error ? '#ef4444' : t.text.muted, fontSize: `${12 * uiScale}px` }}>
                {error ?? 'JSON mode: edit entire script array, then click Apply JSON.'}
            </div>
        </div>
    );
}
import type * as Monaco from 'monaco-editor';

import Editor, { type OnMount } from '@monaco-editor/react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useProjectStore } from '../../../store/useProjectStore';
import { useScriptStore } from '../../../store/useScriptStore';
import { useWorkbenchStore } from '../../../store/useWorkbenchStore';
import { editorTheme as t } from '../../../theme/editorTheme';

export function ScriptJsonEditor({ uiScale }: { uiScale: number }) {
    const rootScript = useScriptStore((s) => s.rootScript);
    const setScript = useScriptStore((s) => s.setScript);

    const editingAllMacrosFile = useProjectStore((s) => s.editingAllMacrosFile);
    const macroEntries = useProjectStore((s) => s.macroEntries);
    const setMacroEntries = useProjectStore((s) => s.setMacroEntries);
    const saveActiveFileFromCurrentScript = useProjectStore((s) => s.saveActiveFileFromCurrentScript);

    const setLastScriptView = useWorkbenchStore((s) => s.setLastScriptView);
    const setLastMacrosView = useWorkbenchStore((s) => s.setLastMacrosView);

    const initial = useMemo(() => {
        if (editingAllMacrosFile) {
            const object: Record<string, any[]> = {};
            for (const m of macroEntries) (object[m.name] = m.commands);
            return JSON.stringify(object, null, 2);
        }
        return JSON.stringify(rootScript, null, 2);
    }, [rootScript, editingAllMacrosFile, macroEntries]);

    const [value, setValue] = useState(initial);
    const [error, setError] = useState<null | string>(null);
    const [previousInitial, setPreviousInitial] = useState(initial);

    if (initial !== previousInitial) {
        setPreviousInitial(initial);
        setValue(initial);
        setError(null);
    }

    useEffect(() => {
        if (editingAllMacrosFile) {
            setLastMacrosView('json');
        } else {
            setLastScriptView('json');
        }
    }, [editingAllMacrosFile, setLastMacrosView, setLastScriptView]);

    const apply = () => {
        try {
            const parsed = JSON.parse(value);

            if (editingAllMacrosFile) {
                if (typeof parsed !== 'object' || Array.isArray(parsed)) {
                    setError('Macros JSON must be an object { "macro_name": [...] }');
                    return;
                }
                const entries = Object.keys(parsed).map((name) => ({ commands: parsed[name], name }));
                setMacroEntries(entries);
            } else {
                if (!Array.isArray(parsed)) {
                    setError('Root JSON must be an array.');
                    return;
                }
                setScript(parsed);
            }
            setError(null);
        } catch (error_: any) {
            setError(error_?.message ?? 'Invalid JSON');
        }
    };

    const formatDocument = async () => {
        if (!editorReference.current) return;
        await editorReference.current.getAction('editor.action.formatDocument')?.run();
    };

    const saveNow = async () => {
        apply();
        await saveActiveFileFromCurrentScript();
    };

    const onMount: OnMount = (editor, monaco) => {
        editorReference.current = editor;

        monaco.editor.defineTheme('zerith-json-dark', {
            base: 'vs-dark',
            colors: {
                'editor.background': '#1e1e1e',
                'editorCursor.foreground': '#f9fafb',
                'editorGutter.background': '#1e1e1e',
                'editorLineNumber.activeForeground': '#9ca3af',
                'editorLineNumber.foreground': '#6b7280',
            },
            inherit: true,
            rules: [],
        });
        monaco.editor.setTheme('zerith-json-dark');

        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
            void saveNow();
        });
    };

    return (
        <div style={{ background: t.bg.app, display: 'grid', gap: `${8 * uiScale}px`, gridTemplateRows: 'auto 1fr auto', height: '100%', padding: `${8 * uiScale}px` }}>
            <div style={{ alignItems: 'center', display: 'flex', gap: `${8 * uiScale}px` }}>
                <strong style={{ color: t.text.primary }}>Script JSON</strong>
                <div style={{ display: 'flex', gap: `${6 * uiScale}px`, marginLeft: 'auto' }}>
                    <button onClick={formatDocument} style={{ background: t.bg.panel, border: `1px solid ${t.border.button}`, borderRadius: t.radius.md, color: t.text.normal, cursor: 'pointer', padding: `${5 * uiScale}px ${10 * uiScale}px` }}>Format</button>
                    <button onClick={apply} style={{ background: t.accent.primary, border: `1px solid ${t.border.primaryBtn}`, borderRadius: t.radius.md, color: t.text.primary, cursor: 'pointer', fontWeight: 700, padding: `${5 * uiScale}px ${10 * uiScale}px` }}>Apply JSON</button>
                </div>
            </div>

            <div style={{ border: `1px solid ${error ? '#ef4444' : t.border.subtle}`, borderRadius: t.radius.md, overflow: 'hidden' }}>
                <Editor
                    defaultLanguage="json"
                    height="100%"
                    onChange={(v) => {
                        setValue(v ?? '');
                        setError(null);
                    }}
                    onMount={onMount}
                    options={{
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                        fontSize: Math.round(12 * uiScale),
                        insertSpaces: true,
                        minimap: { enabled: true },
                        tabSize: 2,
                        wordWrap: 'off',
                    }}
                    value={value}
                />
            </div>

            <div style={{ color: error ? '#ef4444' : t.text.muted, fontSize: `${12 * uiScale}px`, minHeight: `${18 * uiScale}px` }}>
                {error ?? 'JSON mode: edit entire file, then click Apply JSON. Ctrl/Cmd+S saves.'}
            </div>
        </div>
    );
}

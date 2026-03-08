import type { Command } from 'core';
import type * as Monaco from 'monaco-editor';

import Editor, { type OnMount } from '@monaco-editor/react';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { EditorNode } from '../../../types/EditorNode';

import { fsWriteTextFile } from '../../../services/fs';
import { useProjectStore } from '../../../store/useProjectStore';
import { useScriptStore } from '../../../store/useScriptStore';
import { useWorkbenchStore } from '../../../store/useWorkbenchStore';
import { editorTheme as t } from '../../../theme/editorTheme';

type ApplyResult = {
    content?: string;
    ok: boolean;
};

type EditorMode = 'file-json' | 'file-text' | 'macros' | 'readonly' | 'script';

type MonacoThemeApi = {
    editor: {
        defineTheme: (themeName: string, themeData: Monaco.editor.IStandaloneThemeData) => void;
        setTheme: (themeName: string) => void;
    };
    KeyCode: {
        KeyS: number;
    };
    KeyMod: {
        CtrlCmd: number;
    };
};

export function ScriptJsonEditor({ uiScale }: { uiScale: number }) {
    const rootScript = useScriptStore((s) => s.rootScript);
    const setScript = useScriptStore((s) => s.setScript);

    const editingAllMacrosFile = useProjectStore((s) => s.editingAllMacrosFile);
    const macroEntries = useProjectStore((s) => s.macroEntries);
    const setMacroEntries = useProjectStore((s) => s.setMacroEntries);
    const saveActiveFileFromCurrentScript = useProjectStore((s) => s.saveActiveFileFromCurrentScript);

    const activeTab = useWorkbenchStore((s) => s.activeTab());
    const setLastScriptView = useWorkbenchStore((s) => s.setLastScriptView);
    const setLastMacrosView = useWorkbenchStore((s) => s.setLastMacrosView);
    const updateTabContent = useWorkbenchStore((s) => s.updateTabContent);

    const mode = useMemo<EditorMode>(() => {
        if (!activeTab) return 'readonly';
        if (activeTab.kind === 'script') return 'script';
        if (activeTab.kind === 'macros') return 'macros';
        if (activeTab.kind === 'manifest' || activeTab.kind === 'json') return 'file-json';
        if (activeTab.kind === 'text') return 'file-text';
        return 'readonly';
    }, [activeTab]);

    const initial = useMemo(() => {
        if (mode === 'script') return JSON.stringify(rootScript, undefined, 2);

        if (mode === 'macros') {
            const macrosByName: Record<string, Command[]> = {};
            for (const macroEntry of macroEntries) {
                macrosByName[macroEntry.name] = macroEntry.commands;
            }
            return JSON.stringify(macrosByName, undefined, 2);
        }

        if (mode === 'file-json' || mode === 'file-text') {
            return activeTab?.textContent ?? '';
        }

        return '';
    }, [activeTab, macroEntries, mode, rootScript]);

    const editorReference = useRef<Monaco.editor.IStandaloneCodeEditor | undefined>(undefined);
    const sessionKey = activeTab?.id ?? mode;
    const [draftBySession, setDraftBySession] = useState<Record<string, string>>({});
    const [errorBySession, setErrorBySession] = useState<Record<string, string | undefined>>({});
    const value = draftBySession[sessionKey] ?? initial;
    const error = errorBySession[sessionKey];

    const setDraft = (nextValue: string) => {
        setDraftBySession((previous) => ({ ...previous, [sessionKey]: nextValue }));
    };

    const setError = (nextError: string | undefined) => {
        setErrorBySession((previous) => ({ ...previous, [sessionKey]: nextError }));
    };

    useEffect(() => {
        if (mode === 'macros' || editingAllMacrosFile) {
            setLastMacrosView('json');
            return;
        }

        if (mode === 'script') {
            setLastScriptView('json');
        }
    }, [editingAllMacrosFile, mode, setLastMacrosView, setLastScriptView]);

    const apply = (): ApplyResult => {
        if (!activeTab) return { ok: false };

        try {
            if (mode === 'script' || mode === 'macros' || mode === 'file-json') {
                const parsed: unknown = JSON.parse(value);

                if (mode === 'macros') {
                    const entries = toMacroEntries(parsed);
                    if (!entries) {
                        setError('Macros JSON must be an object { "macro_name": [...] }');
                        return { ok: false };
                    }
                    setMacroEntries(entries);
                    setError(undefined);
                    return { ok: true };
                }

                if (mode === 'script') {
                    if (!Array.isArray(parsed)) {
                        setError('Root JSON must be an array.');
                        return { ok: false };
                    }
                    setScript(parsed as EditorNode[]);
                    setError(undefined);
                    return { ok: true };
                }

                const nextText = JSON.stringify(parsed, undefined, 2);
                updateTabContent(activeTab.id, nextText);
                setDraft(nextText);
                setError(undefined);
                return { content: nextText, ok: true };
            }

            if (mode === 'file-text') {
                updateTabContent(activeTab.id, value);
                setError(undefined);
                return { content: value, ok: true };
            }

            setError(undefined);
            return { ok: false };
        } catch (caughtError: unknown) {
            setError(caughtError instanceof Error ? caughtError.message : 'Invalid JSON');
            return { ok: false };
        }
    };

    const formatDocument = () => {
        const editor = editorReference.current;
        if (!editor) return;
        void runFormatDocument(editor);
    };

    const saveNow = async () => {
        const result = apply();
        if (!result.ok) return;

        if (mode === 'script' || mode === 'macros') {
            await saveActiveFileFromCurrentScript();
            return;
        }

        if (!activeTab || !result.content) return;

        try {
            await fsWriteTextFile(activeTab.path, result.content);
            updateTabContent(activeTab.id, result.content);
        } catch (caughtError: unknown) {
            setError(caughtError instanceof Error ? caughtError.message : 'Failed to save file');
        }
    };

    const title = titleForMode(mode, activeTab?.title);
    const language = languageForMode(mode, activeTab?.path);

    const onMount: OnMount = (editor, monaco) => {
        editorReference.current = editor;
        const monacoApi = monaco as unknown as MonacoThemeApi;

        monacoApi.editor.defineTheme('zerith-json-dark', {
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
        monacoApi.editor.setTheme('zerith-json-dark');

        editor.addCommand(monacoApi.KeyMod.CtrlCmd | monacoApi.KeyCode.KeyS, () => {
            void saveNow();
        });
    };

    return (
        <div style={{ background: t.bg.app, display: 'grid', gap: `${8 * uiScale}px`, gridTemplateRows: 'auto 1fr auto', height: '100%', padding: `${8 * uiScale}px` }}>
            <div style={{ alignItems: 'center', display: 'flex', gap: `${8 * uiScale}px` }}>
                <strong style={{ color: t.text.primary }}>{title}</strong>
                <div style={{ display: 'flex', gap: `${6 * uiScale}px`, marginLeft: 'auto' }}>
                    <button onClick={formatDocument} style={{ background: t.bg.panel, border: `1px solid ${t.border.button}`, borderRadius: t.radius.md, color: t.text.normal, cursor: 'pointer', padding: `${5 * uiScale}px ${10 * uiScale}px` }}>Format</button>
                    <button onClick={apply} style={{ background: t.bg.selected, border: `1px solid ${t.border.accent}`, borderRadius: t.radius.md, color: t.text.primary, cursor: 'pointer', fontWeight: 600, padding: `${5 * uiScale}px ${10 * uiScale}px` }}>Apply</button>
                </div>
            </div>

            <div style={{ border: `1px solid ${error ? '#ef4444' : t.border.subtle}`, borderRadius: t.radius.md, overflow: 'hidden' }}>
                <Editor
                    defaultLanguage={language}
                    height="100%"
                    onChange={(v) => {
                        setDraft(v ?? '');
                        setError(undefined);
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
                {error ?? helperTextForMode(mode)}
            </div>
        </div>
    );
}


function helperTextForMode(mode: EditorMode): string {
    if (mode === 'file-text') return 'Text mode: edit file contents and click Apply. Ctrl/Cmd+S saves to disk.';
    if (mode === 'file-json') return 'JSON mode: edit entire file, then click Apply. Ctrl/Cmd+S saves to disk.';
    if (mode === 'macros') return 'Macros JSON mode: edit macro map and click Apply. Ctrl/Cmd+S saves.';
    if (mode === 'script') return 'Script JSON mode: edit command array and click Apply. Ctrl/Cmd+S saves.';
    return 'No editable file selected.';
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function languageForMode(mode: EditorMode, path: string | undefined): string {
    if (mode === 'file-text') {
        if (path?.endsWith('.ts')) return 'typescript';
        if (path?.endsWith('.tsx')) return 'typescript';
        if (path?.endsWith('.js')) return 'javascript';
        if (path?.endsWith('.jsx')) return 'javascript';
        if (path?.endsWith('.css')) return 'css';
        if (path?.endsWith('.html')) return 'html';
        if (path?.endsWith('.md')) return 'markdown';
        return 'plaintext';
    }
    return 'json';
}

async function runFormatDocument(editor: Monaco.editor.IStandaloneCodeEditor): Promise<void> {
    await editor.getAction('editor.action.formatDocument')?.run();
}

function titleForMode(mode: EditorMode, activeTitle: string | undefined): string {
    if (mode === 'file-json') return `JSON: ${activeTitle ?? 'file'}`;
    if (mode === 'file-text') return `Text: ${activeTitle ?? 'file'}`;
    if (mode === 'macros') return 'Macros JSON';
    if (mode === 'script') return 'Script JSON';
    return 'Editor';
}

function toMacroEntries(value: unknown): { commands: Command[]; name: string; }[] | undefined {
    if (!isRecord(value)) return undefined;

    return Object.entries(value).map(([name, commands]) => ({
        commands: Array.isArray(commands) ? (commands as Command[]) : [],
        name,
    }));
}


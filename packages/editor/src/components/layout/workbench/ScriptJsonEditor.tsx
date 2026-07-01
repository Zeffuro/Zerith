import type * as Monaco from 'monaco-editor';
import type { Command } from 'zerith-core';

import Editor, { type OnMount } from '@monaco-editor/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { EditorNode } from '../../../types/EditorNode';

import { fsWriteTextFile } from '../../../services/fs';
import { useProjectStore } from '../../../store/storeBootstrap';
import { useScriptStore } from '../../../store/storeBootstrap';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { useWorkbenchStore } from '../../../store/useWorkbenchStore';
import { editorTheme as t } from '../../../theme/editorTheme';
import { isRecord } from '../../../utils/typeGuards';
import { createJsonSelectionSignature, findJsonSelectionRange } from './jsonSelectionModel';
import { createScriptJsonEditorAccessibilityOptions } from './scriptJsonEditorAccessibilityModel';

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
    languages: {
        json?: {
            jsonDefaults: {
                setDiagnosticsOptions: (options: ZerithJsonDiagnosticsOptions) => void;
            };
        };
    };
};

type SyncPayload = {
    canonical: string;
    pretty: string;
};

type ZerithJsonDiagnosticsOptions = {
    allowComments?: boolean;
    comments?: 'error' | 'ignore' | 'warning';
    enableSchemaRequest?: boolean;
    schemaRequest?: 'error' | 'ignore' | 'warning';
    schemas?: ZerithJsonSchemaRegistration[];
    schemaValidation?: 'error' | 'ignore' | 'warning';
    trailingCommas?: 'error' | 'ignore' | 'warning';
    validate?: boolean;
};

type ZerithJsonSchema = Record<string, unknown>;

type ZerithJsonSchemaRegistration = {
    fileMatch?: string[];
    schema: ZerithJsonSchema;
    uri: string;
};

const FILE_JSON_TAB_KINDS = new Set<string>([
    'audiosheet',
    'characters',
    'engineConfig',
    'items',
    'json',
    'manifest',
    'spritesheet',
]);
const JSON_EDITOR_MODES = new Set<EditorMode>(['file-json', 'macros', 'script']);

const ZERITH_JSON_SCHEMAS: ZerithJsonSchemaRegistration[] = [
    {
        fileMatch: ['**/game.json'],
        schema: looseObjectSchema('zerith/manifest', {
            localization: { type: 'object' },
            macros: { type: ['object', 'string'] },
            scenes: { type: 'object' },
            schemaVersion: { enum: [1, 2] },
            startScene: { type: 'string' },
            title: { type: 'string' },
        }),
        uri: 'zerith://schemas/manifest.json',
    },
    {
        fileMatch: ['**/engine.config.json'],
        schema: looseObjectSchema('zerith/engine-config', {
            audio: { type: 'object' },
            display: { type: 'object' },
            schemaVersion: { enum: [1, 2] },
            theme: { type: 'object' },
        }),
        uri: 'zerith://schemas/engine-config.json',
    },
    {
        fileMatch: ['**/scenes/*.json'],
        schema: {
            oneOf: [
                { items: { type: 'object' }, type: 'array' },
                looseObjectSchema('zerith/scene', {
                    commands: { items: { type: 'object' }, type: 'array' },
                    graph: { type: 'object' },
                    id: { type: 'string' },
                    localeNamespace: { type: 'string' },
                    schemaVersion: { enum: [1, 2] },
                }),
            ],
        },
        uri: 'zerith://schemas/scene.json',
    },
    {
        fileMatch: ['**/locales/*.json'],
        schema: looseObjectSchema('zerith/locale', {
            locale: { type: 'string' },
            namespaces: {
                additionalProperties: {
                    additionalProperties: { type: 'string' },
                    type: 'object',
                },
                type: 'object',
            },
            schemaVersion: { enum: [1, 2] },
        }, ['locale', 'namespaces']),
        uri: 'zerith://schemas/locale.json',
    },
    {
        fileMatch: ['**/data/characters.json', '**/characters.json'],
        schema: looseObjectSchema('zerith/characters'),
        uri: 'zerith://schemas/characters.json',
    },
    {
        fileMatch: ['**/data/items.json', '**/items.json'],
        schema: looseObjectSchema('zerith/items'),
        uri: 'zerith://schemas/items.json',
    },
    {
        fileMatch: ['**/data/macros.json', '**/macros.json'],
        schema: looseObjectSchema('zerith/macros'),
        uri: 'zerith://schemas/macros.json',
    },
    {
        fileMatch: ['**/zerith.content.json'],
        schema: looseObjectSchema('zerith/compiled-content'),
        uri: 'zerith://schemas/compiled-content.json',
    },
];

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

    const monacoReference = useRef<MonacoThemeApi | null>(null);

    const themeKey = useSettingsStore((s) => s.themeKey);
    const customThemes = useSettingsStore((s) => s.customThemes);
    const codeEditorLargeText = useSettingsStore((s) => s.codeEditorLargeText);
    const codeEditorPlainTextComfort = useSettingsStore((s) => s.codeEditorPlainTextComfort);
    const codeEditorScreenReaderMode = useSettingsStore((s) => s.codeEditorScreenReaderMode);

    const mode = useMemo<EditorMode>(() => {
        if (!activeTab) return 'readonly';
        if (activeTab.kind === 'script') return 'script';
        if (activeTab.kind === 'macros') return 'macros';
        if (FILE_JSON_TAB_KINDS.has(activeTab.kind)) return 'file-json';
        if (activeTab.kind === 'text') return 'file-text';
        return 'readonly';
    },[activeTab]);

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
    const appliedJsonSelectionReference = useRef<null | string>(null);
    const suppressNextMonacoChangeBySessionReference = useRef<Record<string, boolean>>({});
    const syncedCanonicalBySessionReference = useRef<Record<string, string>>({});
    const saveNowReference = useRef<() => Promise<void>>(async () => {});
    const sessionKey = activeTab?.id ?? mode;
    const [draftBySession, setDraftBySession] = useState<Record<string, string>>({});
    const [errorBySession, setErrorBySession] = useState<Record<string, string | undefined>>({});
    const value = draftBySession[sessionKey] ?? initial;
    const error = errorBySession[sessionKey];
    const jsonSelectionSignature = createJsonSelectionSignature(activeTab?.jsonSelectionPath);

    const setDraft = useCallback((nextValue: string) => {
        setDraftBySession((previous) => ({ ...previous, [sessionKey]: nextValue }));
    },[sessionKey]);

    const setError = useCallback((nextError: string | undefined) => {
        setErrorBySession((previous) => ({ ...previous, [sessionKey]: nextError }));
    }, [sessionKey]);

    const applyMonacoTheme = useCallback(() => {
        if (!monacoReference.current?.editor) return;
        setTimeout(() => {
            const monacoApi = monacoReference.current;
            if (!monacoApi) return;
            try {
                monacoApi.editor.defineTheme('zerith-dynamic', createMonacoTheme());
                monacoApi.editor.setTheme('zerith-dynamic');
            } catch (error_) {
                console.error('Failed to set monaco theme', error_);
            }
        }, 10);
    }, []);

    useEffect(() => {
        applyMonacoTheme();
    },[themeKey, customThemes, applyMonacoTheme]);

    const visualSyncPayload = useMemo(() => {
        if (mode === 'script') {
            return toSyncPayload(rootScript);
        }

        if (mode === 'macros') {
            const macrosByName: Record<string, Command[]> = {};
            for (const macroEntry of macroEntries) {
                macrosByName[macroEntry.name] = macroEntry.commands;
            }
            return toSyncPayload(macrosByName);
        }

        return;
    },[macroEntries, mode, rootScript]);

    useEffect(() => {
        if (!visualSyncPayload) return;

        const previousCanonical = syncedCanonicalBySessionReference.current[sessionKey];
        if (previousCanonical === visualSyncPayload.canonical) return;

        syncedCanonicalBySessionReference.current[sessionKey] = visualSyncPayload.canonical;
        if (value === visualSyncPayload.pretty) return;

        const editor = editorReference.current;
        if (!editor) return;

        suppressNextMonacoChangeBySessionReference.current[sessionKey] = true;
        editor.getModel()?.setValue(visualSyncPayload.pretty);
    },[sessionKey, value, visualSyncPayload]);

    const syncJsonToVisual = useCallback((sourceText: string) => {
        if (mode !== 'script' && mode !== 'macros') return;

        let parsed: unknown;
        try {
            parsed = JSON.parse(sourceText);
        } catch {
            return;
        }

        if (mode === 'script') {
            if (!Array.isArray(parsed)) return;

            const canonical = JSON.stringify(parsed);
            if (syncedCanonicalBySessionReference.current[sessionKey] === canonical) return;
            syncedCanonicalBySessionReference.current[sessionKey] = canonical;
            setScript(parsed as EditorNode[]);
            return;
        }

        const entries = toMacroEntries(parsed);
        if (!entries) return;

        const canonical = JSON.stringify(parsed);
        if (syncedCanonicalBySessionReference.current[sessionKey] === canonical) return;
        syncedCanonicalBySessionReference.current[sessionKey] = canonical;
        setMacroEntries(entries);
    },[mode, sessionKey, setMacroEntries, setScript]);

    useEffect(() => {
        if (mode === 'macros' || editingAllMacrosFile) {
            setLastMacrosView('json');
            return;
        }

        if (mode === 'script') {
            setLastScriptView('json');
        }
    },[editingAllMacrosFile, mode, setLastMacrosView, setLastScriptView]);

    useEffect(() => {
        if (!JSON_EDITOR_MODES.has(mode) || !activeTab?.jsonSelectionPath || jsonSelectionSignature.length === 0) return;

        const token = `${sessionKey}:${jsonSelectionSignature}`;
        if (appliedJsonSelectionReference.current === token) return;

        const editor = editorReference.current;
        if (!editor) return;

        if (revealJsonSelection(editor, value, activeTab.jsonSelectionPath)) {
            appliedJsonSelectionReference.current = token;
        }
    }, [activeTab?.jsonSelectionPath, jsonSelectionSignature, mode, sessionKey, value]);

    const apply = useCallback((sourceText = value): ApplyResult => {
        if (!activeTab) return { ok: false };

        try {
            if (JSON_EDITOR_MODES.has(mode)) {
                const parsed: unknown = JSON.parse(sourceText);

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
                updateTabContent(activeTab.id, sourceText);
                setDraft(sourceText);
                setError(undefined);
                return { content: sourceText, ok: true };
            }

            setError(undefined);
            return { ok: false };
        } catch (caughtError: unknown) {
            setError(caughtError instanceof Error ? caughtError.message : 'Invalid JSON');
            return { ok: false };
        }
    },[activeTab, mode, setError, setMacroEntries, setScript, setDraft, updateTabContent, value]);

    const formatDocument = () => {
        const editor = editorReference.current;
        if (!editor) return;
        void runFormatDocument(editor);
    };

    const saveNow = useCallback(async () => {
        const sourceText = editorReference.current?.getModel()?.getValue() ?? value;
        const result = apply(sourceText);
        if (!result.ok) return;

        if (mode === 'script' || mode === 'macros') {
            await saveActiveFileFromCurrentScript();
            return;
        }

        if (!activeTab || !result.content) return;

        try {
            await fsWriteTextFile(activeTab.path, result.content);
            updateTabContent(activeTab.id, result.content, { markDirty: false });
        } catch (caughtError: unknown) {
            setError(caughtError instanceof Error ? caughtError.message : 'Failed to save file');
        }
    },[activeTab, apply, mode, saveActiveFileFromCurrentScript, setError, updateTabContent, value]);

    useEffect(() => {
        saveNowReference.current = saveNow;
    }, [saveNow]);

    const title = titleForMode(mode, activeTab?.title);
    const language = languageForMode(mode, activeTab?.path);
    const monacoModelPath = toMonacoModelPath(activeTab?.path, sessionKey, mode);
    const accessibilityOptions = useMemo(() => createScriptJsonEditorAccessibilityOptions({
        codeEditorLargeText,
        codeEditorPlainTextComfort,
        codeEditorScreenReaderMode,
        uiScale,
    }), [codeEditorLargeText, codeEditorPlainTextComfort, codeEditorScreenReaderMode, uiScale]);

    const onMount = ((editor: Monaco.editor.IStandaloneCodeEditor, monaco: MonacoThemeApi) => {
        editorReference.current = editor;
        monacoReference.current = monaco;

        configureZerithJsonDiagnostics(monaco);
        applyMonacoTheme();

        editor.addAction({
            id: 'zerith-save-current-editor',
            keybindings:[monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
            label: 'Save Current File',
            run: async () => {
                await saveNowReference.current();
            },
        });
    }) satisfies OnMount;

    return (
        <div style={{ background: t.bg.app, display: 'grid', gap: `${8 * uiScale}px`, gridTemplateRows: 'auto 1fr auto', height: '100%', padding: `${8 * uiScale}px` }}>
            <div style={{ alignItems: 'center', display: 'flex', gap: `${8 * uiScale}px` }}>
                <strong style={{ color: t.text.primary }}>{title}</strong>
                <div style={{ display: 'flex', gap: `${6 * uiScale}px`, marginLeft: 'auto' }}>
                    <button onClick={formatDocument} style={{ background: t.bg.panel, border: `1px solid ${t.border.button}`, borderRadius: t.radius.md, color: t.text.normal, cursor: 'pointer', padding: `${5 * uiScale}px ${10 * uiScale}px` }}>Format</button>
                    <button onClick={() => apply()} style={{ background: t.bg.selected, border: `1px solid ${t.border.accent}`, borderRadius: t.radius.md, color: t.text.primary, cursor: 'pointer', fontWeight: 600, padding: `${5 * uiScale}px ${10 * uiScale}px` }}>Apply</button>
                </div>
            </div>

            <div style={{ border: `1px solid ${error ? '#ef4444' : t.border.subtle}`, borderRadius: t.radius.md, overflow: 'hidden' }}>
                <Editor
                    defaultLanguage={language}
                    height="100%"
                    onChange={(v = '') => {
                        const nextValue = v;
                        setDraft(nextValue);

                        if (suppressNextMonacoChangeBySessionReference.current[sessionKey]) {
                            suppressNextMonacoChangeBySessionReference.current[sessionKey] = false;
                            setError(undefined);
                            return;
                        }

                        syncJsonToVisual(nextValue);
                        setError(undefined);
                    }}
                    onMount={onMount}
                    options={{
                        ...accessibilityOptions,
                        automaticLayout: true,
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                        insertSpaces: true,
                        mouseWheelZoom: true,
                        tabSize: 2,
                    }}
                    path={monacoModelPath}
                    value={value}
                />
            </div>

            <div style={{ color: error ? '#ef4444' : t.text.muted, fontSize: `${12 * uiScale}px`, minHeight: `${18 * uiScale}px` }}>
                {error ?? helperTextForMode(mode)}
            </div>
        </div>
    );
}

function configureZerithJsonDiagnostics(monaco: MonacoThemeApi): void {
    monaco.languages.json?.jsonDefaults.setDiagnosticsOptions({
        allowComments: true,
        comments: 'error',
        enableSchemaRequest: false,
        schemaRequest: 'ignore',
        schemas: ZERITH_JSON_SCHEMAS,
        schemaValidation: 'warning',
        trailingCommas: 'error',
        validate: true,
    });
}

function createMonacoTheme(): Monaco.editor.IStandaloneThemeData {
    return {
        base: 'vs-dark',
        colors: {
            'editor.background': getMonacoColor('--editor-bg-input', '#1e1e1e'),
            'editor.foreground': getMonacoColor('--editor-text-normal', '#d4d4d4'),
            'editor.inactiveSelectionBackground': getMonacoColor('--editor-bg-hover', '#264f78'),
            'editor.selectionBackground': getMonacoColor('--editor-bg-selected', '#264f78'),
            'editorCursor.foreground': getMonacoColor('--editor-text-primary', '#ffffff'),
            'editorGutter.background': getMonacoColor('--editor-bg-input', '#1e1e1e'),
            'editorIndentGuide.activeBackground': getMonacoColor('--editor-border-normal', '#3c3c3c'),
            'editorIndentGuide.background': getMonacoColor('--editor-border-subtle', '#2d2d2d'),
            'editorLineNumber.activeForeground': getMonacoColor('--editor-text-primary', '#9ca3af'),
            'editorLineNumber.foreground': getMonacoColor('--editor-text-muted', '#6b7280'),
        },
        inherit: true,
        rules:[
            { foreground: getMonacoColor('--editor-syntax-logic', '#9cdcfe'), token: 'string.key.json' },
            { foreground: getMonacoColor('--editor-syntax-media', '#ce9178'), token: 'string.value.json' },
            { foreground: getMonacoColor('--editor-syntax-flow', '#b5cea8'), token: 'number' },
            { foreground: getMonacoColor('--editor-accent-blue', '#569cd6'), token: 'keyword.json' },
            { fontStyle: 'italic', foreground: getMonacoColor('--editor-text-muted', '#6a9955'), token: 'comment' },
        ],
    };
}

function getMonacoColor(name: string, fallback: string): string {
    let raw = fallback;
    try {
        const cssValue = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        if (cssValue) raw = cssValue;
    } catch (error_) {
        void error_;
    }

    if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
        return '#' + raw[1] + raw[1] + raw[2] + raw[2] + raw[3] + raw[3];
    }

    const rgbMatch = raw.match(/rgba?\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
    if (rgbMatch) {
        return '#' + [1, 2, 3].map(index => Number(rgbMatch[index]).toString(16).padStart(2, '0')).join('').toLowerCase();
    }

    return raw;
}

function helperTextForMode(mode: EditorMode): string {
    if (mode === 'file-text') return 'Text mode: edit file contents and click Apply. Ctrl/Cmd+S saves to disk.';
    if (mode === 'file-json') return 'JSON mode: edit entire file, then click Apply. Ctrl/Cmd+S saves to disk.';
    if (mode === 'macros') return 'Macros JSON mode: edit macro map and click Apply. Ctrl/Cmd+S saves.';
    if (mode === 'script') return 'Script JSON mode: edit command array and click Apply. Ctrl/Cmd+S saves.';
    return 'No editable file selected.';
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

function looseObjectSchema(
    schemaName: string,
    properties: Record<string, ZerithJsonSchema> = {},
    required: string[] = [],
): ZerithJsonSchema {
    return {
        additionalProperties: true,
        properties: {
            $schema: { const: schemaName },
            ...properties,
        },
        required,
        type: 'object',
    };
}

function revealJsonSelection(
    editor: Monaco.editor.IStandaloneCodeEditor,
    sourceText: string,
    path: readonly (number | string)[],
): boolean {
    const model = editor.getModel();
    const range = findJsonSelectionRange(sourceText, path);
    if (!model || !range) return false;

    const start = model.getPositionAt(range.start);
    const end = model.getPositionAt(range.end);
    editor.setSelection({
        endColumn: end.column,
        endLineNumber: end.lineNumber,
        startColumn: start.column,
        startLineNumber: start.lineNumber,
    });
    editor.revealPositionInCenter(start);
    editor.focus();
    return true;
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

function toMonacoModelPath(path: string | undefined, sessionKey: string, mode: EditorMode): string {
    if (!path) {
        return `inmemory://zerith/${mode}/${encodeURIComponent(sessionKey)}.json`;
    }

    const normalized = path.replaceAll('\\', '/');
    if (/^[a-z][a-z+.-]*:\/\//iu.test(normalized)) {
        return normalized;
    }

    return /^[a-z]:\//iu.test(normalized)
        ? `file:///${normalized}`
        : `file://${normalized.startsWith('/') ? '' : '/'}${normalized}`;
}

function toSyncPayload(value: unknown): SyncPayload {
    return {
        canonical: JSON.stringify(value),
        pretty: JSON.stringify(value, undefined, 2),
    };
}

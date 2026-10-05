import type * as Monaco from 'monaco-editor';

import { configureSafeJsonCompletion, type JsonCompletionApi, type JsonCompletionService } from './safeJsonCompletion';

export type MonacoThemeApi = {
    editor: {
        defineTheme: (themeName: string, themeData: Monaco.editor.IStandaloneThemeData) => void;
        setTheme: (themeName: string) => void;
    };
    json?: JsonCompletionService & { jsonDefaults: { setDiagnosticsOptions: (options: ZerithJsonDiagnosticsOptions) => void } };
    KeyCode: {
        KeyS: number;
    };
    KeyMod: {
        CtrlCmd: number;
    };
    languages: JsonCompletionApi;
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

export function configureZerithJsonDiagnostics(monaco: MonacoThemeApi): void {
    configureSafeJsonCompletion(monaco.languages, monaco.json);
    monaco.json?.jsonDefaults.setDiagnosticsOptions({
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

export function createMonacoTheme(): Monaco.editor.IStandaloneThemeData {
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


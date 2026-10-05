import type * as Monaco from 'monaco-editor';

export type JsonCompletionApi = Pick<typeof Monaco.languages, 'CompletionItemInsertTextRule' | 'CompletionItemKind' | 'registerCompletionItemProvider'>;
export type JsonCompletionService = {
    getWorker: typeof Monaco.json.getWorker;
    jsonDefaults: Pick<Monaco.json.LanguageServiceDefaults, 'modeConfiguration' | 'setModeConfiguration'>;
};
type JsonCompletionEntry = {
    additionalTextEdits?: { newText: string; range: JsonRange }[];
    command?: { arguments?: unknown[]; command: string; title: string };
    detail?: string;
    documentation?: { kind: string; value: string } | string;
    filterText?: string;
    insertText?: string;
    insertTextFormat?: number;
    kind?: number;
    label: string;
    sortText?: string;
    textEdit?: JsonTextEdit;
};
type JsonCompletionWorker = {
    doComplete: (uri: string, position: { character: number; line: number }) => Promise<{ isIncomplete?: boolean; items: JsonCompletionEntry[] } | null>;
};
type JsonRange = { end: { character: number; line: number }; start: { character: number; line: number } };

type JsonTextEdit = { insert: JsonRange; newText: string; replace: JsonRange } | { newText: string; range: JsonRange };

const configured = new WeakSet<JsonCompletionApi>();

export function configureSafeJsonCompletion(api: JsonCompletionApi, json: JsonCompletionService | undefined): void {
    if (!json || configured.has(api)) return;
    json.jsonDefaults.setModeConfiguration({ ...json.jsonDefaults.modeConfiguration, completionItems: false });
    api.registerCompletionItemProvider('json', createSafeJsonCompletionProvider(api, async uri => {
        const getWorker = await json.getWorker();
        const worker = await getWorker(uri);
        return worker as unknown as JsonCompletionWorker;
    }));
    configured.add(api);
}

export function createSafeJsonCompletionProvider(
    api: Pick<JsonCompletionApi, 'CompletionItemInsertTextRule' | 'CompletionItemKind'>,
    workerFor: (uri: Monaco.Uri) => Promise<JsonCompletionWorker>,
): Monaco.languages.CompletionItemProvider {
    return {
        async provideCompletionItems(model, position, _context, token) {
            if (model.isDisposed() || token.isCancellationRequested) return;
            const version = model.getVersionId();
            const current = () => !token.isCancellationRequested && !model.isDisposed() && model.getVersionId() === version;
            // Capture the replacement range before the worker can outlive the model.
            const word = model.getWordUntilPosition(position);
            const range: Monaco.IRange = { endColumn: word.endColumn, endLineNumber: position.lineNumber, startColumn: word.startColumn, startLineNumber: position.lineNumber };
            try {
                const worker = await workerFor(model.uri);
                if (!current()) return;
                const info = await worker.doComplete(model.uri.toString(), { character: position.column - 1, line: position.lineNumber - 1 });
                if (!current() || !info) return;
                return { incomplete: info.isIncomplete, suggestions: info.items.map(entry => completionItem(api, entry, range)) };
            } catch (error) {
                if (current()) throw error;
                return;
            }
        },
        triggerCharacters: [' ', ':', '"'],
    };
}

function completionItem(api: Pick<JsonCompletionApi, 'CompletionItemInsertTextRule' | 'CompletionItemKind'>, entry: JsonCompletionEntry, range: Monaco.IRange): Monaco.languages.CompletionItem {
    const kinds = api.CompletionItemKind;
    const kind = [kinds.Text, kinds.Method, kinds.Function, kinds.Constructor, kinds.Field, kinds.Variable, kinds.Class, kinds.Interface, kinds.Module, kinds.Property, kinds.Unit, kinds.Value, kinds.Enum, kinds.Keyword, kinds.Snippet, kinds.Color, kinds.File, kinds.Reference][(entry.kind ?? 0) - 1] ?? kinds.Property;
    const item: Monaco.languages.CompletionItem = {
        command: entry.command?.command === 'editor.action.triggerSuggest' ? { arguments: entry.command.arguments, id: entry.command.command, title: entry.command.title } : undefined,
        detail: entry.detail,
        documentation: entry.documentation,
        filterText: entry.filterText,
        insertText: entry.insertText || entry.label,
        kind,
        label: entry.label,
        range,
        sortText: entry.sortText,
    };
    if (entry.textEdit) {
        item.range = 'range' in entry.textEdit ? toRange(entry.textEdit.range) : { insert: toRange(entry.textEdit.insert), replace: toRange(entry.textEdit.replace) };
        item.insertText = entry.textEdit.newText;
    }
    if (entry.additionalTextEdits) item.additionalTextEdits = entry.additionalTextEdits.map(edit => ({ range: toRange(edit.range), text: edit.newText }));
    if (entry.insertTextFormat === 2) item.insertTextRules = api.CompletionItemInsertTextRule.InsertAsSnippet;
    return item;
}

function toRange(range: JsonRange): Monaco.IRange {
    return { endColumn: range.end.character + 1, endLineNumber: range.end.line + 1, startColumn: range.start.character + 1, startLineNumber: range.start.line + 1 };
}

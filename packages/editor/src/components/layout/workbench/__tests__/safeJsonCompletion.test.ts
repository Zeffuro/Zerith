import type * as Monaco from 'monaco-editor';

import { describe, expect, it, vi } from 'vitest';

import { configureSafeJsonCompletion, createSafeJsonCompletionProvider, type JsonCompletionApi } from '../safeJsonCompletion';

const kindNames = ['Text', 'Method', 'Function', 'Constructor', 'Field', 'Variable', 'Class', 'Interface', 'Module', 'Property', 'Unit', 'Value', 'Enum', 'Keyword', 'Snippet', 'Color', 'File', 'Reference'];
const api = {
    CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
    CompletionItemKind: Object.fromEntries(kindNames.map((name, index) => [name, index])),
} as unknown as Pick<JsonCompletionApi, 'CompletionItemInsertTextRule' | 'CompletionItemKind'>;
const position = { column: 4, lineNumber: 1 } as Monaco.Position;

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
    return { promise, reject, resolve };
}

function fixture() {
    let disposed = false;
    let version = 1;
    const getWordUntilPosition = vi.fn(() => {
        if (disposed) throw new Error('TextModelPart is disposed');
        return { endColumn: 4, startColumn: 2, word: 'key' };
    });
    const model = {
        getVersionId: () => version,
        getWordUntilPosition,
        isDisposed: () => disposed,
        uri: { toString: () => 'file:///Game/locales/en.json' },
    } as unknown as Monaco.editor.ITextModel;
    const token = { isCancellationRequested: false, onCancellationRequested: vi.fn() } as unknown as Monaco.CancellationToken;
    const complete = deferred<{ items: { label: string }[] }>();
    const doComplete = vi.fn(() => complete.promise);
    const worker = { doComplete };
    const provider = createSafeJsonCompletionProvider(api, () => Promise.resolve(worker));
    const provide = () => Promise.resolve(provider.provideCompletionItems(model, position, { triggerKind: 0 }, token));
    return { complete, dispose: () => { disposed = true; }, doComplete, edit: () => { ++version; }, getWordUntilPosition, model, provide, token };
}

describe('JSON completion lifetime', () => {
    it.each(['dispose', 'cancel', 'edit'] as const)('drops delayed completions after %s without reading a stale model', async change => {
        const state = fixture();
        const result = state.provide();
        await vi.waitFor(() => expect(state.doComplete).toHaveBeenCalledTimes(1));
        if (change === 'dispose') state.dispose();
        else if (change === 'edit') state.edit();
        else (state.token as { isCancellationRequested: boolean }).isCancellationRequested = true;
        state.complete.resolve({ items: [{ label: 'late' }] });
        expect(await result).toBeUndefined();
        expect(state.getWordUntilPosition).toHaveBeenCalledTimes(1);
    });

    it('does not launch a worker request for an already disposed model', async () => {
        const state = fixture();
        state.dispose();
        expect(await state.provide()).toBeUndefined();
        expect(state.doComplete).not.toHaveBeenCalled();
        expect(state.getWordUntilPosition).not.toHaveBeenCalled();
    });

    it('does not launch completion after disposal while acquiring the worker', async () => {
        const state = fixture();
        const acquiring = deferred<{ doComplete: typeof state.doComplete }>();
        const provider = createSafeJsonCompletionProvider(api, () => acquiring.promise);
        const result = provider.provideCompletionItems(state.model, position, { triggerKind: 0 }, state.token);
        state.dispose();
        acquiring.resolve({ doComplete: state.doComplete });
        expect(await result).toBeUndefined();
        expect(state.doComplete).not.toHaveBeenCalled();
    });

    it('preserves worker errors for the current editor', async () => {
        const state = fixture();
        const result = state.provide();
        await vi.waitFor(() => expect(state.doComplete).toHaveBeenCalledTimes(1));
        state.complete.reject(new Error('Current worker failure'));
        await expect(result).rejects.toThrow('Current worker failure');
    });

    it('discards a worker rejection after the model is disposed', async () => {
        const state = fixture();
        const result = state.provide();
        await vi.waitFor(() => expect(state.doComplete).toHaveBeenCalledTimes(1));
        state.dispose();
        state.complete.reject(new Error('Stale worker failure'));
        expect(await result).toBeUndefined();
    });

    it('preserves completion edits, snippets, documentation and trigger command', async () => {
        const state = fixture();
        const worker = { doComplete: vi.fn(() => Promise.resolve({ isIncomplete: true, items: [{
            additionalTextEdits: [{ newText: 'extra', range: { end: { character: 1, line: 2 }, start: { character: 0, line: 2 } } }],
            command: { arguments: ['again'], command: 'editor.action.triggerSuggest', title: 'Suggest' },
            detail: 'property detail',
            documentation: 'Help',
            insertTextFormat: 2,
            kind: 10,
            label: 'property',
            textEdit: { insert: { end: { character: 3, line: 0 }, start: { character: 1, line: 0 } }, newText: '${1:value}', replace: { end: { character: 5, line: 0 }, start: { character: 1, line: 0 } } },
        }] })) };
        const provider = createSafeJsonCompletionProvider(api, () => Promise.resolve(worker));
        const result = await provider.provideCompletionItems(state.model, position, { triggerKind: 0 }, state.token);
        expect(provider.triggerCharacters).toEqual([' ', ':', '"']);
        expect(worker.doComplete).toHaveBeenCalledWith('file:///Game/locales/en.json', { character: 3, line: 0 });
        expect(result).toMatchObject({ incomplete: true, suggestions: [{
            additionalTextEdits: [{ range: { endColumn: 2, endLineNumber: 3, startColumn: 1, startLineNumber: 3 }, text: 'extra' }],
            command: { arguments: ['again'], id: 'editor.action.triggerSuggest', title: 'Suggest' },
            detail: 'property detail',
            documentation: 'Help',
            insertText: '${1:value}',
            insertTextRules: api.CompletionItemInsertTextRule.InsertAsSnippet,
            kind: api.CompletionItemKind.Property,
            label: 'property',
            range: { insert: { endColumn: 4, endLineNumber: 1, startColumn: 2, startLineNumber: 1 }, replace: { endColumn: 6, endLineNumber: 1, startColumn: 2, startLineNumber: 1 } },
        }] });
    });

    it('replaces only builtin JSON completion and registers the safe provider once', () => {
        const modeConfiguration = { completionItems: true, diagnostics: true, hovers: true };
        const setModeConfiguration = vi.fn();
        const registerCompletionItemProvider = vi.fn();
        const configuredApi: JsonCompletionApi = { ...api, registerCompletionItemProvider };
        const json = { getWorker: vi.fn<typeof Monaco.json.getWorker>(), jsonDefaults: { modeConfiguration, setModeConfiguration } };
        configureSafeJsonCompletion(configuredApi, json);
        configureSafeJsonCompletion(configuredApi, json);
        expect(setModeConfiguration).toHaveBeenCalledExactlyOnceWith({ completionItems: false, diagnostics: true, hovers: true });
        expect(registerCompletionItemProvider).toHaveBeenCalledTimes(1);
        expect(registerCompletionItemProvider.mock.calls[0][0]).toBe('json');
        expect(registerCompletionItemProvider.mock.calls[0][1] as unknown).toHaveProperty('provideCompletionItems');
    });
});

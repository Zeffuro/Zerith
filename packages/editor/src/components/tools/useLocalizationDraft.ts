import { useEffect, useMemo, useRef, useState } from 'react';

import type { LocalizationPanelRow } from './localizationPanelModel';

import { fsJoin, fsPickBinaryFiles, fsPickDirectory, fsWriteTextFile } from '../../services/fs';
import {
    createLocalizationLocale,
    editLocalizationDraft,
    getLocalizationDraftBundle,
    getLocalizationDraftTab,
    getLocalizationSavedBundle,
    prepareLocalizationDraft,
    saveLocalizationDraft,
} from '../../services/localizationDrafts';
import { useProjectStore } from '../../store/storeBootstrap';
import { useWorkbenchStore } from '../../store/useWorkbenchStore';
import {
    createLocaleBundleFromRows,
    createLocalizationRoundTripDocument,
    createMissingLocaleEntryDrafts,
    createTranslatorImportDrafts,
    getLocalizationRoundTripFileName,
    pruneUnusedLocaleBundleEntries,
    toLocalizationEntryKey,
    updateLocaleBundleEntries,
} from './localizationPanelModel';

export function useLocalizationDraft(locale: string) {
    const projectPath = useProjectStore(state => state.projectPath);
    const generation = useProjectStore(state => state.projectGeneration);
    useProjectStore(state => state.locales);
    useWorkbenchStore(state => state.tabs);
    const [prepared, setPrepared] = useState<string>();
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState<{ kind: 'error' | 'ok'; text: string }>();
    const identity = `${generation}:${projectPath}:${locale}`;
    const token = useMemo(() => ({ identity }), [identity]);
    const owner = useRef(token);
    owner.current = token;
    const locked = useRef(false);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);

    useEffect(() => {
        let live = true;
        locked.current = false;
        setStatus(undefined);
        setBusy(false);
        if (projectPath && locale) {
            void prepareLocalizationDraft(locale).then(() => {
                if (live) setPrepared(identity);
            }).catch((error: unknown) => {
                if (live) setStatus({ kind: 'error', text: formatError(error) });
            });
        }
        return () => { live = false; };
    }, [identity, locale, projectPath, token]);

    const current = () => owner.current === token && mounted.current
        && useProjectStore.getState().projectPath === projectPath
        && useProjectStore.getState().projectGeneration === generation;
    const { dirty, parseError, savedBundle, selectedBundle } = (() => {
        if (!locale || !projectPath) return {};
        try {
            return {
                dirty: getLocalizationDraftTab(locale)?.dirty === true,
                savedBundle: getLocalizationSavedBundle(locale),
                selectedBundle: getLocalizationDraftBundle(locale),
            };
        } catch (error) { return { parseError: formatError(error) }; }
    })();
    const draftValues: Record<string, string> = {};
    for (const [namespace, entries] of Object.entries(selectedBundle?.namespaces ?? {})) {
        for (const [lineId, value] of Object.entries(entries)) {
            if (value !== savedBundle?.namespaces[namespace]?.[lineId]) draftValues[toLocalizationEntryKey(namespace, lineId)] = value;
        }
    }
    for (const [namespace, entries] of Object.entries(savedBundle?.namespaces ?? {})) {
        for (const lineId of Object.keys(entries)) {
            if (selectedBundle && selectedBundle.namespaces[namespace]?.[lineId] === undefined) draftValues[toLocalizationEntryKey(namespace, lineId)] = '';
        }
    }
    const dirtyEntryCount = dirty ? Math.max(1, Object.keys(draftValues).length) : 0;
    const ready = prepared === identity && !parseError;
    const run = async (action: () => Promise<string>) => {
        if (locked.current || !current()) return;
        locked.current = true;
        setBusy(true);
        try {
            const text = await action();
            if (current()) setStatus({ kind: 'ok', text });
        } catch (error) {
            if (current()) setStatus({ kind: 'error', text: formatError(error) });
        } finally {
            if (current()) { locked.current = false; setBusy(false); }
        }
    };
    const edit = (updates: Record<string, string>) => {
        if (!ready || !current()) return;
        try { editLocalizationDraft(locale, bundle => updateLocaleBundleEntries(bundle, updates)); }
        catch (error) { setStatus({ kind: 'error', text: formatError(error) }); }
    };

    return {
        busy,
        dirtyEntryCount,
        draftValues,
        handleAddLocale: async (nextLocale: string, rows: LocalizationPanelRow[], onCreated: () => void) => {
            await run(async () => {
                await createLocalizationLocale(nextLocale, createLocaleBundleFromRows(nextLocale, rows));
                if (current()) onCreated();
                return `Created ${nextLocale}.`;
            });
        },
        handleDraftChange: (key: string, value: string) => edit({ [key]: value }),
        handleExport: async (rows: LocalizationPanelRow[]) => {
            const document = createLocalizationRoundTripDocument(locale, rows, draftValues);
            await run(async () => {
                const directory = await fsPickDirectory('Export translator JSON to folder...');
                if (!directory || !current()) return 'Export cancelled.';
                const target = await fsJoin(directory, getLocalizationRoundTripFileName(locale));
                await fsWriteTextFile(target, `${JSON.stringify(document, undefined, 4)}\n`, { createOnly: true }, current);
                return `Exported ${document.entries.length} visible localization entries to ${target}.`;
            });
        },
        handleFillMissing: (rows: LocalizationPanelRow[]) => {
            const updates = createMissingLocaleEntryDrafts(rows);
            edit(updates);
            const count = Object.keys(updates).length;
            setStatus({ kind: 'ok', text: `Prepared ${count} missing locale entr${count === 1 ? 'y' : 'ies'} from source text.` });
        },
        handleImport: () => run(async () => {
            const [file] = await fsPickBinaryFiles({ filters: [{ extensions: ['json'], name: 'Translator JSON' }], multiple: false, title: 'Import translator JSON' });
            if (!file || !current()) return 'Import cancelled.';
            const result = createTranslatorImportDrafts(JSON.parse(new TextDecoder().decode(file.bytes)) as unknown);
            if (result.locale && result.locale !== locale) throw new Error(`Translator file is for ${result.locale}. Select that locale before importing.`);
            edit(result.updates);
            return `Imported ${Object.keys(result.updates).length} translator entries from ${file.name}.`;
        }),
        handlePrune: (rows: LocalizationPanelRow[]) => run(async () => {
            editLocalizationDraft(locale, bundle => pruneUnusedLocaleBundleEntries(bundle, rows));
            await saveLocalizationDraft(locale);
            return `Pruned unused locale entries from ${locale}.`;
        }),
        handleSave: () => run(async () => {
            await saveLocalizationDraft(locale);
            return `Saved ${locale}.`;
        }),
        ready,
        selectedBundle: savedBundle ?? selectedBundle,
        status: parseError ? { kind: 'error' as const, text: parseError } : status,
    };
}

function formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

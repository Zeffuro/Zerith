import type { LocaleBundle } from '@zeffuro/zerith-core';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    mkdir: vi.fn<() => Promise<void>>(),
    read: vi.fn<(path: string) => Promise<string>>(),
    write: vi.fn<(path: string, text: string, options?: { createOnly?: boolean; expectedContent?: string }, isCurrent?: () => boolean) => Promise<void>>(),
}));
vi.mock('../fs', () => ({ fsMkdir: mocks.mkdir, fsReadTextFile: mocks.read, fsWriteTextFile: mocks.write }));
vi.mock('@zeffuro/zerith-core', () => ({ deepClone: structuredClone, WEATHER_PRESET_DEFAULTS: {} }));

import { useProjectStore } from '../../store/storeBootstrap';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useWorkbenchStore } from '../../store/useWorkbenchStore';
import {
    createLocalizationLocale,
    editLocalizationDraft,
    getLocalizationDraftBundle,
    getLocalizationDraftTab,
    getLocalizationSavedBundle,
    prepareLocalizationDraft,
    saveLocalizationDraft,
    saveLocalizationFileDraft,
} from '../localizationDrafts';
import { readDrafts } from '../recovery/draftStorage';
import { startRecoverySession } from '../recovery/recoverySession';
import { saveAllFiles } from '../saveAllFiles';

const en: LocaleBundle = { locale: 'en', namespaces: { intro: { greeting: 'Hello' } } };
const nl: LocaleBundle = { locale: 'nl', namespaces: { intro: { greeting: 'Hallo' } } };
const enPath = '/Game/locales/en.json';
const manifestPath = '/Game/game.json';
const disk = new Map<string, string>();
const loadManifest = vi.fn<() => Promise<boolean>>();
let stopRecovery: (() => void) | undefined;

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; });
    return { promise, resolve };
}

function greeting(locale: string, value: string) {
    editLocalizationDraft(locale, bundle => ({ ...bundle, namespaces: { ...bundle.namespaces, intro: { ...bundle.namespaces.intro, greeting: value } } }));
}

function project(inline = false) {
    useProjectStore.getState().setProject('/Game', []);
    useProjectStore.setState({
        loadManifest,
        localePaths: inline ? {} : { en: enPath, nl: '/Game/locales/nl.json' },
        locales: { en, nl },
    });
    disk.set(manifestPath, JSON.stringify({ localization: { defaultLocale: 'en', locales: inline ? { en, nl } : { en: '/locales/en.json', nl: '/locales/nl.json' } }, title: 'Game' }, undefined, 2));
}

beforeEach(() => {
    useWorkbenchStore.getState().clearTabs();
    useProjectStore.getState().setProject(undefined, []);
    disk.clear();
    disk.set(enPath, `${JSON.stringify(en, undefined, 2)}\n`);
    disk.set('/Game/locales/nl.json', JSON.stringify(nl));
    loadManifest.mockReset().mockResolvedValue(true);
    mocks.read.mockReset().mockImplementation(path => {
        if (!disk.has(path)) throw new Error('Missing file');
        return Promise.resolve(disk.get(path)!);
    });
    mocks.mkdir.mockReset().mockResolvedValue();
    mocks.write.mockReset().mockImplementation((path: string, text: string, options?: { createOnly?: boolean; expectedContent?: string }, isCurrent?: () => boolean) => {
        if (isCurrent && !isCurrent()) throw new Error('Project changed');
        if (options?.createOnly && disk.has(path)) throw new Error('Already exists');
        if (options?.expectedContent !== undefined && disk.get(path) !== options.expectedContent) throw new Error('External change');
        disk.set(path, text);
        return Promise.resolve();
    });
    project();
});
afterEach(() => { stopRecovery?.(); stopRecovery = undefined; });

describe('localization file drafts', () => {

    it('loads an ordinary backing tab without changing the active panel and retains exact baseline bytes', async () => {
        useWorkbenchStore.setState({ activeTabId: 'panel' });
        const tab = await prepareLocalizationDraft('en');
        expect(tab).toMatchObject({ kind: 'json', path: enPath, savedTextContent: disk.get(enPath), textContent: disk.get(enPath) });
        expect(useWorkbenchStore.getState().activeTabId).toBe('panel');
        expect(getLocalizationDraftBundle('en')).toEqual(en);
        expect(getLocalizationSavedBundle('en')).toEqual(en);
    });

    it('reuses a raw dirty tab and merges localization operations into its current values', async () => {
        const raw = JSON.stringify({ ...en, namespaces: { intro: { extra: 'Keep', greeting: 'Raw edit' } } });
        useWorkbenchStore.getState().openOrFocusTab({ id: 'raw', kind: 'text', path: enPath, savedTextContent: disk.get(enPath), textContent: raw, title: 'raw' });
        useWorkbenchStore.getState().updateTabContent('raw', raw);
        const tab = await prepareLocalizationDraft('en');
        expect(tab.id).toBe('raw');
        greeting('en', 'Panel edit');
        expect(getLocalizationDraftBundle('en')?.namespaces.intro).toEqual({ extra: 'Keep', greeting: 'Panel edit' });
        expect(useWorkbenchStore.getState().tabs).toHaveLength(1);
    });

    it('retains both locale drafts and marks their backing files dirty', async () => {
        await prepareLocalizationDraft('en');
        greeting('en', 'English draft');
        await prepareLocalizationDraft('nl');
        greeting('nl', 'Dutch draft');
        await prepareLocalizationDraft('en');
        expect(getLocalizationDraftBundle('en')?.namespaces.intro.greeting).toBe('English draft');
        expect(getLocalizationDraftBundle('nl')?.namespaces.intro.greeting).toBe('Dutch draft');
        expect([...useProjectStore.getState().dirtyFiles]).toEqual([enPath, '/Game/locales/nl.json']);
    });

    it('returns to the exact saved bytes and clears dirty state after a semantic revert', async () => {
        const baseline = disk.get(enPath);
        await prepareLocalizationDraft('en');
        greeting('en', 'Draft');
        greeting('en', 'Hello');
        expect(getLocalizationDraftTab('en')).toMatchObject({ dirty: false, textContent: baseline });
        expect(useProjectStore.getState().dirtyFiles.size).toBe(0);
    });

    it.each([true, false])('retains exact saved bytes for schema-normalized fields on revert (inline=%s)', async inline => {
        project(inline);
        const normalized = { ...en, locale: ' en ' };
        const path = inline ? manifestPath : enPath;
        const text = JSON.stringify(inline ? { localization: { locales: { en: normalized } } } : normalized, undefined, 2);
        disk.set(path, text);
        await prepareLocalizationDraft('en');
        greeting('en', 'Changed');
        greeting('en', 'Hello');
        expect(getLocalizationDraftTab('en')).toMatchObject({ dirty: false, textContent: text });
    });

    it.each([true, false])('preserves persisted drafts after project close/reopen (inline=%s)', async inline => {
        project(inline);
        const data = new Map<string, string>();
        const storage = { getItem: (key: string) => data.get(key) ?? '', setItem: (key: string, value: string) => { data.set(key, value); } };
        useSettingsStore.getState().setRecoveryEnabled(true);
        stopRecovery = startRecoverySession(storage);
        await prepareLocalizationDraft('en');
        greeting('en', 'Recovered draft');
        const saved = getLocalizationDraftTab('en')?.savedTextContent;
        useProjectStore.getState().setProject(undefined, []);
        useWorkbenchStore.getState().clearTabs();
        project(inline);
        const recovered = readDrafts(storage)[0].files[0];
        expect(recovered).toMatchObject({ kind: inline ? 'manifest' : 'json', path: inline ? manifestPath : enPath, savedText: saved });
        expect(JSON.parse(recovered.text)).toMatchObject(inline ? { localization: { locales: { en: { namespaces: { intro: { greeting: 'Recovered draft' } } } } } } : { namespaces: { intro: { greeting: 'Recovered draft' } } });
        expect(mocks.write).not.toHaveBeenCalled();
    });

    it('ignores a stale baseline read after reopening the same project', async () => {
        const reading = deferred<string>();
        mocks.read.mockReturnValueOnce(reading.promise);
        const preparing = prepareLocalizationDraft('en');
        project();
        reading.resolve(JSON.stringify(en));
        await expect(preparing).rejects.toThrow('Project changed');
        expect(useWorkbenchStore.getState().tabs).toHaveLength(0);
    });

    it('reuses a tab opened while its baseline read was pending', async () => {
        const reading = deferred<string>();
        mocks.read.mockReturnValueOnce(reading.promise);
        const preparing = prepareLocalizationDraft('en');
        useWorkbenchStore.getState().openOrFocusTab({ id: 'raw', kind: 'json', path: enPath, savedTextContent: JSON.stringify(en), textContent: JSON.stringify(en), title: 'raw' });
        greeting('en', 'Concurrent draft');
        reading.resolve(JSON.stringify(en));
        const prepared = await preparing;
        expect(prepared.id).toBe('raw');
        expect(getLocalizationDraftBundle('en')?.namespaces.intro.greeting).toBe('Concurrent draft');
        expect(useWorkbenchStore.getState().tabs).toHaveLength(1);
    });

    it.each(['savedTextContent', 'textContent'] as const)('blocks editing a tab with invalid %s', async field => {
        useWorkbenchStore.getState().openOrFocusTab({ id: 'bad', kind: 'json', path: enPath, savedTextContent: JSON.stringify(en), textContent: JSON.stringify(en), title: 'bad' });
        useWorkbenchStore.setState(state => ({ tabs: state.tabs.map(tab => ({ ...tab, [field]: '{' })) }));
        await expect(prepareLocalizationDraft('en')).rejects.toThrow();
        expect(() => greeting('en', 'Lost')).toThrow();
        expect(mocks.write).not.toHaveBeenCalled();
    });

    it('blocks duplicate path aliases before an edit or save can overwrite a raw draft', async () => {
        await prepareLocalizationDraft('en');
        useWorkbenchStore.getState().openOrFocusTab({ id: 'alias', kind: 'text', path: '/Game/locales/./en.json', textContent: JSON.stringify(en), title: 'alias' });
        useWorkbenchStore.getState().updateTabContent('alias', JSON.stringify({ ...en, note: 'raw draft' }));
        expect(() => greeting('en', 'Overwritten')).toThrow('Multiple editors');
        await expect(saveLocalizationDraft('en')).rejects.toThrow('Multiple editors');
        expect(mocks.write).not.toHaveBeenCalled();
    });
});

describe('localization guarded saves and inline manifests', () => {
    it('does not reconcile Save All into a closed and reopened locale tab', async () => {
        await prepareLocalizationDraft('en');
        greeting('en', 'Earlier draft');
        const writing = deferred<void>();
        mocks.write.mockReturnValueOnce(writing.promise);
        const pending = saveAllFiles(useProjectStore.getState);
        await vi.waitFor(() => expect(mocks.write).toHaveBeenCalledOnce());
        const old = getLocalizationDraftTab('en')!;
        useWorkbenchStore.getState().closeTab(old.id);
        await prepareLocalizationDraft('en');
        const replacement = getLocalizationDraftTab('en')!;
        writing.resolve();
        expect(await pending).toMatchObject({ saved: [], skipped: [enPath] });
        expect(getLocalizationDraftTab('en')).toBe(replacement);
        expect(replacement.savedTextContent).toBe(disk.get(enPath));
    });
    it.each(['remove', 'rename', 'externalize'] as const)('saves valid raw inline locale %s edits through the guarded file path', async change => {
        project(true);
        await prepareLocalizationDraft('en');
        const tab = getLocalizationDraftTab('en')!;
        const data = JSON.parse(tab.textContent!) as { localization: { locales: Record<string, unknown> } };
        if (change === 'externalize') data.localization.locales.en = '/locales/en.json';
        else {
            delete data.localization.locales.en;
            if (change === 'rename') data.localization.locales.renamed = { ...en, locale: 'renamed' };
        }
        const text = JSON.stringify(data);
        useWorkbenchStore.getState().updateTabContent(tab.id, text);
        await saveLocalizationFileDraft(manifestPath);
        expect(disk.get(manifestPath)).toBe(text);
        expect(useWorkbenchStore.getState().tabs.find(entry => entry.id === tab.id)).toMatchObject({ dirty: false, savedTextContent: text });
    });
    it('rejects an invalid inline manifest even when its locale bundle is valid', async () => {
        project(true);
        await prepareLocalizationDraft('en');
        const tab = getLocalizationDraftTab('en')!;
        const data = JSON.parse(tab.textContent!) as Record<string, unknown>;
        data.title = 42;
        useWorkbenchStore.getState().updateTabContent(tab.id, JSON.stringify(data));
        await expect(saveLocalizationDraft('en')).rejects.toThrow();
        expect(mocks.write).not.toHaveBeenCalled();
        expect(getLocalizationDraftTab('en')?.dirty).toBe(true);
    });
    it('saves file edits with exact expectedContent and clears only the captured revision', async () => {
        const baseline = disk.get(enPath);
        await prepareLocalizationDraft('en');
        greeting('en', 'Saved');
        const text = getLocalizationDraftTab('en')?.textContent;
        await saveLocalizationDraft('en');
        expect(mocks.write).toHaveBeenCalledWith(enPath, text, { expectedContent: baseline }, expect.any(Function));
        expect(getLocalizationDraftTab('en')).toMatchObject({ dirty: false, savedTextContent: text, textContent: text });
        expect(loadManifest).toHaveBeenCalledTimes(1);
    });

    it.each(['External change', 'Permission denied'])('retains edits and baseline after %s', async error => {
        await prepareLocalizationDraft('en');
        greeting('en', 'Draft');
        const tab = getLocalizationDraftTab('en');
        mocks.write.mockRejectedValueOnce(new Error(error));
        await expect(saveLocalizationDraft('en')).rejects.toThrow(error);
        expect(getLocalizationDraftTab('en')).toBe(tab);
        expect(tab?.dirty).toBe(true);
        expect(loadManifest).not.toHaveBeenCalled();
    });

    it('keeps a newer mid-save edit dirty while advancing the written baseline', async () => {
        await prepareLocalizationDraft('en');
        greeting('en', 'Earlier');
        const written = getLocalizationDraftTab('en')?.textContent;
        mocks.write.mockImplementationOnce(() => { greeting('en', 'Newer'); return Promise.resolve(); });
        await expect(saveLocalizationDraft('en')).rejects.toThrow('Newer edits remain unsaved');
        expect(getLocalizationDraftTab('en')).toMatchObject({ dirty: true, savedTextContent: written });
        expect(getLocalizationDraftBundle('en')?.namespaces.intro.greeting).toBe('Newer');
        expect(loadManifest).not.toHaveBeenCalled();
    });

    it('does not reconcile a pending save into the same-path reopened project', async () => {
        await prepareLocalizationDraft('en');
        greeting('en', 'Old draft');
        const writing = deferred<void>();
        mocks.write.mockReturnValueOnce(writing.promise);
        const saving = saveLocalizationDraft('en');
        await vi.waitFor(() => expect(mocks.write).toHaveBeenCalledTimes(1));
        useWorkbenchStore.getState().clearTabs();
        project();
        await prepareLocalizationDraft('en');
        greeting('en', 'Replacement draft');
        const replacement = getLocalizationDraftTab('en');
        writing.resolve();
        await expect(saving).rejects.toThrow('Project changed');
        expect(getLocalizationDraftTab('en')).toBe(replacement);
        expect(loadManifest).not.toHaveBeenCalled();
    });

    it('does not reconcile into a closed and reopened same-ID tab within the session', async () => {
        await prepareLocalizationDraft('en');
        greeting('en', 'Draft');
        const writing = deferred<void>();
        mocks.write.mockReturnValueOnce(writing.promise);
        const saving = saveLocalizationDraft('en');
        await vi.waitFor(() => expect(mocks.write).toHaveBeenCalledTimes(1));
        const old = getLocalizationDraftTab('en')!;
        useWorkbenchStore.getState().closeTab(old.id);
        useWorkbenchStore.getState().openOrFocusTab(old);
        writing.resolve();
        await expect(saving).rejects.toThrow('Project changed');
        expect(getLocalizationDraftTab('en')?.savedTextContent).toBe(old.savedTextContent);
        expect(getLocalizationDraftTab('en')?.dirty).toBe(true);
    });

    it('reports a failed refresh after saving while retaining the successfully written baseline', async () => {
        await prepareLocalizationDraft('en');
        greeting('en', 'Saved');
        loadManifest.mockResolvedValueOnce(false);
        await expect(saveLocalizationDraft('en')).rejects.toThrow('refreshing the project failed');
        expect(getLocalizationDraftTab('en')).toMatchObject({ dirty: false, savedTextContent: disk.get(enPath) });
    });

    it('rejects a stale refresh without changing the replacement session', async () => {
        await prepareLocalizationDraft('en');
        greeting('en', 'Saved');
        const loading = deferred<boolean>();
        loadManifest.mockReturnValueOnce(loading.promise);
        const saving = saveLocalizationDraft('en');
        await vi.waitFor(() => expect(loadManifest).toHaveBeenCalledTimes(1));
        useWorkbenchStore.getState().clearTabs();
        project();
        await prepareLocalizationDraft('en');
        greeting('en', 'Replacement');
        const replacement = getLocalizationDraftTab('en');
        loading.resolve(true);
        await expect(saving).rejects.toThrow('Project changed');
        expect(getLocalizationDraftTab('en')).toBe(replacement);
    });

    it('edits inline locales in the manifest draft without externalizing or losing sibling edits', async () => {
        project(true);
        await prepareLocalizationDraft('en');
        const tab = getLocalizationDraftTab('en')!;
        const raw = JSON.parse(tab.textContent!) as { title: string };
        raw.title = 'Other draft';
        useWorkbenchStore.getState().updateTabContent(tab.id, JSON.stringify(raw));
        greeting('en', 'Inline draft');
        await prepareLocalizationDraft('nl');
        greeting('nl', 'Dutch draft');
        expect(getLocalizationDraftTab('en')).toBe(getLocalizationDraftTab('nl'));
        await saveLocalizationDraft('en');
        const saved = JSON.parse(disk.get(manifestPath)!) as { localization: { locales: Record<string, LocaleBundle> }; title: string; };
        expect(saved.title).toBe('Other draft');
        expect(saved.localization.locales.en.namespaces.intro.greeting).toBe('Inline draft');
        expect(saved.localization.locales.nl.namespaces.intro.greeting).toBe('Dutch draft');
        expect(mocks.write).toHaveBeenCalledTimes(1);
        expect(mocks.mkdir).not.toHaveBeenCalled();
    });

    it('restores exact inline baseline bytes on revert but retains unrelated manifest drafts', async () => {
        project(true);
        await prepareLocalizationDraft('en');
        const baseline = getLocalizationDraftTab('en')?.savedTextContent;
        greeting('en', 'Changed');
        greeting('en', 'Hello');
        expect(getLocalizationDraftTab('en')).toMatchObject({ dirty: false, textContent: baseline });
        const tab = getLocalizationDraftTab('en')!;
        useWorkbenchStore.getState().updateTabContent(tab.id, JSON.stringify({ ...(JSON.parse(tab.textContent!) as Record<string, unknown>), title: 'Other draft' }));
        greeting('en', 'Changed');
        greeting('en', 'Hello');
        expect(getLocalizationDraftTab('en')?.dirty).toBe(true);
        expect(JSON.parse(getLocalizationDraftTab('en')!.textContent!) as unknown).toMatchObject({ title: 'Other draft' });
    });
});

describe('new locale creation safety', () => {
    it('creates the bundle before a guarded manifest reference and reconciles a clean manifest tab', async () => {
        const baseline = disk.get(manifestPath)!;
        useWorkbenchStore.getState().openOrFocusTab({ id: 'manifest', kind: 'manifest', path: manifestPath, textContent: baseline, title: 'game.json' });
        await createLocalizationLocale('fr', { ...en, locale: 'fr' });
        expect(mocks.write.mock.calls.map(call => call[0])).toEqual(['/Game/locales/fr.json', manifestPath]);
        expect(mocks.write).toHaveBeenNthCalledWith(1, '/Game/locales/fr.json', expect.any(String), { createOnly: true }, expect.any(Function));
        expect(mocks.write).toHaveBeenNthCalledWith(2, manifestPath, expect.any(String), { expectedContent: baseline }, expect.any(Function));
        expect(useWorkbenchStore.getState().tabs[0]).toMatchObject({ dirty: false, savedTextContent: disk.get(manifestPath), textContent: disk.get(manifestPath) });
    });

    it.each(['EN', 'e/n'])('rejects normalized filename collision for %s', async name => {
        const configuredName = name === 'e/n' ? 'e?n' : 'en';
        useProjectStore.setState({ locales: { [configuredName]: { ...en, locale: configuredName } } });
        disk.set(manifestPath, JSON.stringify({ localization: { locales: { [configuredName]: { ...en, locale: configuredName } } } }));
        await expect(createLocalizationLocale(name, { ...en, locale: name })).rejects.toThrow('conflicts');
        expect(mocks.write).not.toHaveBeenCalled();
    });

    it('blocks dirty manifest aliases before creating a bundle', async () => {
        const raw = disk.get(manifestPath)!;
        useWorkbenchStore.getState().openOrFocusTab({ id: 'raw', kind: 'text', path: '/Game/./game.json', textContent: raw, title: 'raw' });
        useWorkbenchStore.getState().updateTabContent('raw', raw);
        await expect(createLocalizationLocale('fr', { ...en, locale: 'fr' })).rejects.toThrow('unsaved');
        expect(mocks.write).not.toHaveBeenCalled();
    });

    it('leaves a manifest untouched when exclusive bundle creation fails', async () => {
        const manifest = disk.get(manifestPath);
        disk.set('/Game/locales/fr.json', 'unrelated');
        await expect(createLocalizationLocale('fr', { ...en, locale: 'fr' })).rejects.toThrow('Already exists');
        expect(disk.get(manifestPath)).toBe(manifest);
        expect(disk.get('/Game/locales/fr.json')).toBe('unrelated');
        expect(loadManifest).not.toHaveBeenCalled();
    });

    it('reports and retains a created file after manifest conflict', async () => {
        const manifest = disk.get(manifestPath);
        mocks.write.mockImplementationOnce((path: string, text: string) => { disk.set(path, text); return Promise.resolve(); });
        mocks.write.mockRejectedValueOnce(new Error('External change'));
        await expect(createLocalizationLocale('fr', { ...en, locale: 'fr' })).rejects.toThrow('Locale file was created at /Game/locales/fr.json');
        expect(disk.get(manifestPath)).toBe(manifest);
        expect(JSON.parse(disk.get('/Game/locales/fr.json')!) as unknown).toMatchObject({ locale: 'fr' });
        expect(loadManifest).not.toHaveBeenCalled();
    });

    it('stops before bundle creation after a stale manifest read', async () => {
        const reading = deferred<string>();
        mocks.read.mockReturnValueOnce(reading.promise);
        const creating = createLocalizationLocale('fr', { ...en, locale: 'fr' });
        project();
        reading.resolve(disk.get(manifestPath)!);
        await expect(creating).rejects.toThrow('Project changed');
        expect(mocks.mkdir).not.toHaveBeenCalled();
        expect(mocks.write).not.toHaveBeenCalled();
    });

    it('stops before bundle creation after a project switch during mkdir', async () => {
        mocks.mkdir.mockImplementationOnce(() => { project(); return Promise.resolve(); });
        await expect(createLocalizationLocale('fr', { ...en, locale: 'fr' })).rejects.toThrow('Project changed');
        expect(mocks.write).not.toHaveBeenCalled();
    });

    it('retains the partial bundle and does not write a manifest after a project switch during creation', async () => {
        const manifest = disk.get(manifestPath);
        mocks.write.mockImplementationOnce((path: string, text: string) => { disk.set(path, text); project(); return Promise.resolve(); });
        await expect(createLocalizationLocale('fr', { ...en, locale: 'fr' })).rejects.toThrow('Locale file was created at /Game/locales/fr.json');
        expect(mocks.write).toHaveBeenCalledTimes(1);
        expect(disk.get(manifestPath)).toBe(manifest);
        expect(loadManifest).not.toHaveBeenCalled();
    });

    it('retains the partial bundle when a new manifest draft appears during creation', async () => {
        mocks.write.mockImplementationOnce((path: string, text: string) => {
            disk.set(path, text);
            useProjectStore.getState().markFileDirty(manifestPath);
            return Promise.resolve();
        });
        await expect(createLocalizationLocale('fr', { ...en, locale: 'fr' })).rejects.toThrow('unsaved or newer edits');
        expect(mocks.write).toHaveBeenCalledTimes(1);
        expect(loadManifest).not.toHaveBeenCalled();
    });
});

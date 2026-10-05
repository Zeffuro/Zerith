import type { LocaleBundle } from '@zeffuro/zerith-core';

import { GameManifestSchema, LocaleBundleSchema } from '@zeffuro/zerith-core/schemas';

import type { WorkbenchTab } from '../store/useWorkbenchStore';

import { getLocaleManifestPath } from '../components/tools/localizationPanelModel';
import { resolveProjectFilePath } from '../store/project/projectPreparation';
import { useProjectStore } from '../store/storeBootstrap';
import { makeTabId, useWorkbenchStore } from '../store/useWorkbenchStore';
import { canonicalPathForComparison } from '../utils/pathComparison';
import { isRecord } from '../utils/typeGuards';
import { fsMkdir, fsReadTextFile, fsWriteTextFile } from './fs';
import { validateLocalizationFileSnapshot } from './localizationFileSnapshot';
import { saveWorkbenchTextFile } from './saveWorkbenchFile';

export async function createLocalizationLocale(locale: string, candidate: LocaleBundle): Promise<void> {
    const owner = session();
    if (!locale.trim() || locale !== locale.trim()) throw new Error('Enter a locale without surrounding spaces.');
    const bundle = LocaleBundleSchema.parse(candidate);
    if (bundle.locale !== locale) throw new Error('Locale bundle ID must match the new locale.');
    const manifestPath = resolveProjectFilePath(owner.path, 'game.json');
    const manifestTab = findBackingTab(manifestPath);
    ensureCleanManifest(manifestPath, manifestTab);
    const baseline = manifestTab?.savedTextContent ?? await fsReadTextFile(manifestPath);
    owner.check();
    const manifest = parseManifest(baseline);
    GameManifestSchema.parse(manifest);
    const localization = isRecord(manifest.localization) ? manifest.localization : {};
    const configured = isRecord(localization.locales) ? localization.locales : {};
    const relativePath = getLocaleManifestPath(locale);
    const path = resolveProjectFilePath(owner.path, relativePath);
    assertAvailableLocale(locale, path, configured, owner.path);
    const isCurrent = () => owner.isCurrent() && manifestUnchanged(manifestPath, manifestTab);
    const check = () => {
        owner.check();
        if (!manifestUnchanged(manifestPath, manifestTab)) throw new Error('Manifest has unsaved or newer edits. Save it before adding a locale.');
        assertAvailableLocale(locale, path, configured, owner.path);
    };
    check();
    await fsMkdir(resolveProjectFilePath(owner.path, 'locales'), true);
    check();
    await fsWriteTextFile(path, JSON.stringify(bundle, undefined, 4), { createOnly: true }, isCurrent);
    try {
        check();
        manifest.localization = { ...localization, defaultLocale: typeof localization.defaultLocale === 'string' ? localization.defaultLocale : locale, locales: { ...configured, [locale]: relativePath } };
        const text = JSON.stringify(manifest, undefined, 4);
        await fsWriteTextFile(manifestPath, text, { expectedContent: baseline }, isCurrent);
        owner.check();
        if (manifestTab && manifestUnchanged(manifestPath, manifestTab)) {
            useWorkbenchStore.getState().updateTabContent(manifestTab.id, text, { markDirty: false });
        }
        await reload(owner);
        useProjectStore.getState().bumpTreeRevision();
    } catch (error) {
        throw new Error(`Locale file was created at ${path}, but adding it to the project did not finish: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
}

export function editLocalizationDraft(locale: string, transform: (bundle: LocaleBundle) => LocaleBundle): void {
    const tab = getLocalizationDraftTab(locale);
    if (!tab) throw new Error('Locale is still loading. Try editing again when it is ready.');
    validateTab(tab, locale);
    const bundle = LocaleBundleSchema.parse(transform(bundleFromText(tab.textContent, locale)));
    const saved = JSON.parse(tab.savedTextContent!) as unknown;
    const reverted = equivalent(bundle, bundleFromText(tab.savedTextContent, locale));
    const nextBundle = reverted && isInline(locale) ? inlineBundle(saved, locale) : bundle;
    const next = isInline(locale) ? replaceInlineBundle(tab.textContent!, locale, nextBundle) : (reverted ? saved : bundle);
    const unchanged = equivalent(next, saved);
    const text = unchanged ? tab.savedTextContent! : JSON.stringify(next, undefined, 4);
    useWorkbenchStore.getState().updateTabContent(tab.id, text, { markDirty: !unchanged });
}

export function getLocalizationDraftBundle(locale: string): LocaleBundle | undefined {
    const tab = getLocalizationDraftTab(locale);
    return tab ? bundleFromText(tab.textContent, locale) : useProjectStore.getState().locales[locale];
}

export function getLocalizationDraftTab(locale: string): undefined | WorkbenchTab {
    if (!useProjectStore.getState().projectPath) return undefined;
    return findBackingTab(backingPath(locale));
}

export function getLocalizationSavedBundle(locale: string): LocaleBundle | undefined {
    const tab = getLocalizationDraftTab(locale);
    return tab ? bundleFromText(tab.savedTextContent, locale) : useProjectStore.getState().locales[locale];
}

export async function prepareLocalizationDraft(locale: string): Promise<WorkbenchTab> {
    const owner = session();
    const path = backingPath(locale);
    const existing = findBackingTab(path);
    if (existing) {
        validateTab(existing, locale);
        return existing;
    }
    const text = await fsReadTextFile(path);
    owner.check();
    const concurrent = findBackingTab(path);
    if (concurrent) {
        validateTab(concurrent, locale);
        return concurrent;
    }
    const kind = isInline(locale) ? 'manifest' : 'json';
    const tab: WorkbenchTab = { id: makeTabId(kind, path), kind, path, savedTextContent: text, textContent: text, title: path.split(/[\\/]/u).pop() ?? locale };
    validateTab(tab, locale);
    useWorkbenchStore.setState(state => ({ tabs: [...state.tabs, tab] }));
    return tab;
}

export async function saveLocalizationDraft(locale: string): Promise<void> {
    const owner = session();
    const tab = await prepareLocalizationDraft(locale);
    owner.check();
    await saveLocalizationFileDraft(tab.path);
}

export async function saveLocalizationFileDraft(path: string): Promise<void> {
    const owner = session();
    const tab = findBackingTab(path);
    if (!tab || tab.textContent === undefined || tab.savedTextContent === undefined) throw new Error('Localization file has no editor snapshot. Reopen it before saving.');
    if (!tab.dirty) return;
    const text = tab.textContent;
    validateLocalizationFileSnapshot(tab.path, text, useProjectStore.getState());
    let removed = false;
    const unsubscribe = useWorkbenchStore.subscribe(state => {
        if (!state.tabs.some(entry => entry.id === tab.id && entry.path === tab.path)) removed = true;
    });
    const isCurrent = () => {
        if (removed || !owner.isCurrent()) return false;
        try {
            const current = findBackingTab(tab.path);
            return current?.id === tab.id && current.savedTextContent === tab.savedTextContent;
        } catch { return false; }
    };
    try {
        await saveWorkbenchTextFile(tab.path, text, isCurrent);
        owner.check();
        const current = findBackingTab(tab.path);
        if (!current || current.id !== tab.id || current.textContent !== text || current.savedTextContent !== text) {
            throw new Error('Earlier revision saved. Newer edits remain unsaved.');
        }
        useWorkbenchStore.getState().updateTabContent(tab.id, text, { markDirty: false });
        await reload(owner);
    } finally {
        unsubscribe();
    }
}

function assertAvailableLocale(locale: string, path: string, configured: Record<string, unknown>, projectPath: string): void {
    const current = useProjectStore.getState();
    const names = new Set([...Object.keys(configured), ...Object.keys(current.locales), ...Object.keys(current.localePaths)]);
    for (const name of names) {
        const entry = configured[name];
        const configuredPath = typeof entry === 'string' ? resolveProjectFilePath(projectPath, entry) : undefined;
        if (name === locale || fileNameKey(getLocaleManifestPath(name)) === fileNameKey(getLocaleManifestPath(locale))
            || configuredPath && pathKey(configuredPath) === pathKey(path)
            || current.localePaths[name] && pathKey(current.localePaths[name]) === pathKey(path)) {
            throw new Error(`Locale ${locale} conflicts with existing locale ${name} or its filename.`);
        }
    }
    if (findBackingTab(path) || [...current.dirtyFiles].some(entry => pathKey(entry) === pathKey(path))) {
        throw new Error('The new locale filename is already open or has unsaved edits.');
    }
}

function backingPath(locale: string): string {
    const project = useProjectStore.getState();
    if (!project.projectPath) throw new Error('Open a project to edit locale strings.');
    if (!Object.hasOwn(project.locales, locale)) throw new Error(`Locale ${locale} is unavailable.`);
    return project.localePaths[locale] ?? resolveProjectFilePath(project.projectPath, 'game.json');
}

function bundleFromText(text: string | undefined, locale: string): LocaleBundle {
    if (text === undefined) throw new Error('Locale editor has no file snapshot. Reopen it before editing.');
    const data = JSON.parse(text) as unknown;
    const candidate = isInline(locale) ? inlineBundle(data, locale) : data;
    return LocaleBundleSchema.parse(candidate);
}

function ensureCleanManifest(path: string, tab: undefined | WorkbenchTab): void {
    if (tab?.dirty || [...useProjectStore.getState().dirtyFiles].some(entry => pathKey(entry) === pathKey(path))) {
        throw new Error('Manifest has unsaved edits. Save it before adding a locale.');
    }
    if (tab && (tab.savedTextContent === undefined || tab.textContent !== tab.savedTextContent)) {
        throw new Error('Manifest editor does not match its saved snapshot. Save it before adding a locale.');
    }
}

function equivalent(left: unknown, right: unknown): boolean {
    if (left === right) return true;
    if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((item, index) => equivalent(item, right[index]));
    if (!isRecord(left) || !isRecord(right)) return false;
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && equivalent(left[key], right[key]));
}

function fileNameKey(path: string): string {
    return path.replaceAll('\\', '/').toLowerCase();
}

function findBackingTab(path: string): undefined | WorkbenchTab {
    const tabs = useWorkbenchStore.getState().tabs.filter(tab => pathKey(tab.path) === pathKey(path));
    if (tabs.length > 1) throw new Error('Multiple editors refer to this locale file. Close duplicate editors before editing localization.');
    return tabs[0];
}

function inlineBundle(data: unknown, locale: string): unknown {
    if (!isRecord(data) || !isRecord(data.localization) || !isRecord(data.localization.locales)) throw new Error('Manifest has no inline locales.');
    return data.localization.locales[locale];
}

function isInline(locale: string): boolean {
    return !useProjectStore.getState().localePaths[locale];
}

function manifestUnchanged(path: string, tab: undefined | WorkbenchTab): boolean {
    try {
        ensureCleanManifest(path, findBackingTab(path));
        return findBackingTab(path) === tab;
    } catch { return false; }
}

function parseManifest(text: string): Record<string, unknown> {
    const data = JSON.parse(text) as unknown;
    if (!isRecord(data)) throw new Error('Manifest must be an object.');
    return data;
}

function pathKey(path: string): string {
    return canonicalPathForComparison(path);
}

async function reload(owner: ReturnType<typeof session>): Promise<void> {
    owner.check();
    const loaded = await useProjectStore.getState().loadManifest();
    owner.check();
    if (!loaded) throw new Error('File saved, but refreshing the project failed. Reopen the project to review it.');
}

function replaceInlineBundle(text: string, locale: string, bundle: unknown): Record<string, unknown> {
    const manifest = parseManifest(text);
    const localization = manifest.localization as Record<string, unknown>;
    const locales = localization.locales as Record<string, unknown>;
    return { ...manifest, localization: { ...localization, locales: { ...locales, [locale]: bundle } } };
}

function session() {
    const { projectGeneration, projectPath } = useProjectStore.getState();
    if (!projectPath) throw new Error('Open a project to edit locale strings.');
    const isCurrent = () => useProjectStore.getState().projectGeneration === projectGeneration && useProjectStore.getState().projectPath === projectPath;
    const check = () => { if (!isCurrent()) throw new Error('Project changed while editing localization. The current project was kept.'); };
    return { check, isCurrent, path: projectPath };
}

function validateTab(tab: WorkbenchTab, locale: string): void {
    bundleFromText(tab.savedTextContent, locale);
    bundleFromText(tab.textContent, locale);
}

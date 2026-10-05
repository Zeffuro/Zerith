import type { RecoveryOffer } from './recoveryState';

import { beginProjectOpenRequest, executeOpenProjectInCurrentWindow } from '../../store/actions/projectOpenActions';
import { useProjectStore } from '../../store/storeBootstrap';
import { useEditorStore } from '../../store/useEditorStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { makeTabId, useWorkbenchStore } from '../../store/useWorkbenchStore';
import { fsReadTextFile } from '../fs';
import { browserFsAdapter } from '../fs/browserFsAdapter';
import { isTauriRuntime } from '../runtime/runtimeEnvironment';
import { type DraftStorage, isRecoveryPath, readDrafts, recoveryIdentity, replaceDraft } from './draftStorage';
import { useRecoveryStore } from './recoveryState';

let currentStorage: DraftStorage | undefined;
let sessionSequence = 0;
let suppressCapture = false;
let currentCapture: (() => void) | undefined;
let adoptDraft: ((id: string) => void) | undefined;
let reviewDraft: ((id?: string) => void) | undefined;

export function discardRecoveryDraft(projectPath: string, id?: string): void {
    try {
        if (!currentStorage) return;
        replaceDraft(currentStorage, projectPath, [], id);
        refreshDrafts();
        if (useRecoveryStore.getState().offer?.projectPath === projectPath) useRecoveryStore.setState({ offer: undefined });
    } catch (error) { report(error); }
}

export function keepRecoveryDraft(): void {
    useRecoveryStore.setState({ offer: undefined, startupVisible: false });
}

export async function openRecoveryProject(projectPath: string, draftId?: string): Promise<boolean> {
    const manifestPath = `${projectPath}/game.json`;
    const baseRequest = beginProjectOpenRequest();
    const lifetime = sessionSequence;
    const ownsLifetime = () => lifetime === sessionSequence && currentStorage !== undefined;
    const request = { ...baseRequest, isCurrent: () => ownsLifetime() && baseRequest.isCurrent(), isLatest: () => ownsLifetime() && baseRequest.isLatest() };
    if (!isTauriRuntime() && !await browserFsAdapter.recentProjects.restore(manifestPath)) return false;
    if (!request.isCurrent()) return false;
    const result = await executeOpenProjectInCurrentWindow(manifestPath, { checkMigration: false, request });
    const opened = result.status === 'opened-current';
    if (opened) reviewDraft?.(draftId);
    return opened;
}

export function restoreRecoveryDraft(offer: RecoveryOffer): boolean {
    const state = useProjectStore.getState();
    if (state.projectGeneration !== offer.generation || state.projectPath !== offer.projectPath || useRecoveryStore.getState().offer !== offer) return false;
    const tabs = useWorkbenchStore.getState().tabs;
    if (offer.files.some(file => state.dirtyFiles.has(file.path) || tabs.some(tab => tab.path === file.path && tab.dirty))) {
        report(new Error('Open files have newer unsaved edits. Keep this recovery draft and save or close those files before restoring.'));
        return false;
    }
    suppressCapture = true;
    try {
        adoptDraft?.(offer.draftId);
        state.clearActiveFile();
        for (const file of offer.files) {
            for (const tab of tabs.filter(tab => tab.path === file.path)) useWorkbenchStore.getState().closeTab(tab.id);
            const kind = file.kind === 'script' || file.kind === 'macros' ? 'json' : file.kind;
            const id = makeTabId(kind, file.path);
            useWorkbenchStore.getState().openOrFocusTab({ id, kind, path: file.path, savedTextContent: file.savedText, textContent: file.text, title: file.title });
            useWorkbenchStore.getState().updateTabContent(id, file.text);
        }
        useRecoveryStore.setState({ offer: undefined });
        useEditorStore.getState().announceOperationStatus('Recovered edits are open and unsaved. Review them, then save when ready.', 'success');
        return true;
    } finally { suppressCapture = false; currentCapture?.(); }
}

export function reviewRecoveryDrafts(): void {
    if (useProjectStore.getState().projectPath) reviewDraft?.();
    else useRecoveryStore.setState({ startupVisible: true });
}

export function startRecoverySession(storage: DraftStorage = globalThis.localStorage): () => void {
    currentStorage = storage;
    const lifetime = ++sessionSequence;
    let generation = -1;
    let ownedPaths = new Set<string>();
    let projectPath: string | undefined;
    let sequence = 0;
    let disposed = false;
    let captureDraftId: string = crypto.randomUUID();
    try { refreshDrafts(); } catch (error) { report(error); }

    const review = (draftId?: string) => {
        const request = ++sequence;
        useRecoveryStore.setState({ offer: undefined });
        if (!projectPath || !useSettingsStore.getState().recoveryEnabled) return;
        const path = projectPath;
        const sessionGeneration = generation;
        try {
            const draft = readDrafts(storage).find(entry => recoveryIdentity(entry.projectPath) === recoveryIdentity(path) && (draftId === undefined || entry.id === draftId));
            if (!draft) return;
            void Promise.all(draft.files.map(async file => {
                try { return { ...file, diskText: await fsReadTextFile(file.path) }; }
                catch (error) { return { ...file, diskError: error instanceof Error ? error.message : String(error) }; }
            })).then(files => {
                if (disposed || lifetime !== sessionSequence || request !== sequence || useProjectStore.getState().projectGeneration !== sessionGeneration || useProjectStore.getState().projectPath !== path) return;
                useRecoveryStore.setState({ offer: { draftId: draft.id, files, generation: sessionGeneration, projectPath: path }, startupVisible: false });
            });
        } catch (error) { report(error); }
    };
    const onProject = () => {
        const state = useProjectStore.getState();
        if (generation === state.projectGeneration && projectPath === state.projectPath) return;
        generation = state.projectGeneration;
        projectPath = state.projectPath;
        ownedPaths = new Set();
        captureDraftId = crypto.randomUUID();
        review();
    };

    const capture = () => {
        onProject();
        if (disposed || suppressCapture || !projectPath || !useSettingsStore.getState().recoveryEnabled) return;
        const state = useProjectStore.getState();
        const tabs = useWorkbenchStore.getState().tabs;
        const files = tabs.filter(tab => isRecoveryPath(projectPath!, tab.path) && state.dirtyFiles.has(tab.path)
            && tab.dirty && tab.textContent !== undefined && tab.savedTextContent !== undefined)
            .map(tab => ({ kind: tab.kind, path: tab.path, savedText: tab.savedTextContent!, text: tab.textContent!, title: tab.title }));
        if (files.length === 0 && ownedPaths.size === 0) return;
        try {
            const previous = readDrafts(storage).find(entry => entry.id === captureDraftId && recoveryIdentity(entry.projectPath) === recoveryIdentity(projectPath!));
            const paths = new Set(files.map(file => recoveryIdentity(file.path)));
            const kept = previous?.files.filter(file => !ownedPaths.has(recoveryIdentity(file.path)) && !paths.has(recoveryIdentity(file.path))) ?? [];
            replaceDraft(storage, projectPath, [...kept, ...files], captureDraftId);
            ownedPaths = paths;
            refreshDrafts();
        } catch (error) { report(error); }
    };
    onProject();
    currentCapture = capture;
    adoptDraft = id => { captureDraftId = id; ownedPaths = new Set(); };
    reviewDraft = review;
    const unsubscribers = [useProjectStore.subscribe(capture), useWorkbenchStore.subscribe(capture), useSettingsStore.subscribe((state, previous) => {
        if (state.recoveryEnabled !== previous.recoveryEnabled) {
            if (state.recoveryEnabled) { generation = -1; onProject(); capture(); }
            else { ++sequence; useRecoveryStore.setState({ offer: undefined, startupVisible: false }); }
        }
    })];
    return () => {
        disposed = true;
        ++sequence;
        for (const unsubscribe of unsubscribers) unsubscribe();
        if (lifetime === sessionSequence) { ++sessionSequence; currentStorage = undefined; currentCapture = undefined; adoptDraft = undefined; reviewDraft = undefined; }
    };
}

function refreshDrafts(): void {
    if (currentStorage) useRecoveryStore.setState({ drafts: readDrafts(currentStorage) });
}

function report(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    if (useRecoveryStore.getState().error === message) return;
    useRecoveryStore.setState({ error: message });
    useEditorStore.getState().announceOperationStatus(`Unsaved work recovery: ${message}`, 'warning');
}

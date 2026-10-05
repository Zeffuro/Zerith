import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ read: vi.fn<(path: string) => Promise<string>>(), write: vi.fn() }));
vi.mock('../fs', () => ({ fsReadTextFile: mocks.read, fsWriteTextFile: mocks.write }));
vi.mock('@zeffuro/zerith-core', () => ({ deepClone: structuredClone, WEATHER_PRESET_DEFAULTS: {} }));

import { useProjectStore } from '../../store/storeBootstrap';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useWorkbenchStore } from '../../store/useWorkbenchStore';
import { browserFsAdapter } from '../fs/browserFsAdapter';
import { DRAFT_STORAGE_KEY, MAX_DRAFT_BYTES, readDrafts, type RecoveryFile, replaceDraft } from '../recovery/draftStorage';
import { discardRecoveryDraft, keepRecoveryDraft, openRecoveryProject, restoreRecoveryDraft, startRecoverySession } from '../recovery/recoverySession';
import { useRecoveryStore } from '../recovery/recoveryState';
import { saveWorkbenchTextFile } from '../saveWorkbenchFile';

const file: RecoveryFile = { kind: 'script', path: '/Game/intro.json', savedText: 'original', text: 'unsaved', title: 'intro.json' };
function storage() {
    const data = new Map<string, string>();
    return { getItem: (key: string) => data.get(key) ?? '', setItem: (key: string, value: string) => { data.set(key, value); } };
}
let stop: (() => void) | undefined;

describe('unsaved work recovery', () => {
    beforeEach(() => {
        useWorkbenchStore.getState().clearTabs();
        useProjectStore.getState().setProject(undefined, []);
        useSettingsStore.getState().setRecoveryEnabled(true);
        useRecoveryStore.setState({ drafts: [], error: undefined, offer: undefined, startupVisible: true });
        mocks.read.mockReset().mockResolvedValue('original');
        mocks.write.mockReset().mockImplementation(async () => {});
    });
    afterEach(() => { stop?.(); stop = undefined; });

    it('persists edits immediately without writing game files and removes a saved draft', () => {
        const disk = storage();
        stop = startRecoverySession(disk);
        useProjectStore.getState().setProject('/Game', []);
        useWorkbenchStore.getState().openOrFocusTab({ id: 'intro', kind: 'script', path: file.path, savedTextContent: 'original', textContent: 'original', title: file.title });
        useWorkbenchStore.getState().updateTabContent('intro', 'changed');
        expect(readDrafts(disk)[0].files).toEqual([{ ...file, text: 'changed' }]);
        expect(mocks.write).not.toHaveBeenCalled();
        useWorkbenchStore.getState().updateTabContent('intro', 'changed', { markDirty: false });
        expect(readDrafts(disk)).toEqual([]);
    });

    it('offers persisted work after a new lifetime and restores raw edits with the original save guard', async () => {
        const disk = storage();
        replaceDraft(disk, '/Game', [file]);
        stop = startRecoverySession(disk);
        useProjectStore.getState().setProject('/Game', []);
        await vi.waitFor(() => expect(useRecoveryStore.getState().offer).toBeDefined());
        expect(restoreRecoveryDraft(useRecoveryStore.getState().offer!)).toBe(true);
        const tab = useWorkbenchStore.getState().tabs[0];
        expect(tab).toMatchObject({ dirty: true, kind: 'json', savedTextContent: 'original', textContent: 'unsaved' });
        expect(mocks.write).not.toHaveBeenCalled();
        await saveWorkbenchTextFile(file.path, file.text);
        expect(mocks.write).toHaveBeenCalledWith(file.path, file.text, { expectedContent: 'original' });
        useWorkbenchStore.getState().updateTabContent(tab.id, file.text, { markDirty: false });
        expect(readDrafts(disk)).toEqual([]);
    });

    it('retains external changes in the preview and a failed normal save keeps the draft', async () => {
        const disk = storage();
        replaceDraft(disk, '/Game', [file]);
        mocks.read.mockResolvedValue('external version');
        stop = startRecoverySession(disk);
        useProjectStore.getState().setProject('/Game', []);
        await vi.waitFor(() => expect(useRecoveryStore.getState().offer?.files[0].diskText).toBe('external version'));
        restoreRecoveryDraft(useRecoveryStore.getState().offer!);
        mocks.write.mockRejectedValue(new Error('External change'));
        await expect(saveWorkbenchTextFile(file.path, file.text)).rejects.toThrow('External change');
        expect(readDrafts(disk)[0].files[0]).toEqual({ ...file, kind: 'json' });
    });

    it('clears a stale visual model and replaces clean same-path tabs before save all', async () => {
        const disk = storage();
        replaceDraft(disk, '/Game', [file]);
        stop = startRecoverySession(disk);
        useProjectStore.getState().setProject('/Game', []);
        useProjectStore.getState().setActiveFile(file.path, []);
        useWorkbenchStore.getState().openOrFocusTab({ id: 'old', kind: 'script', path: file.path, savedTextContent: file.savedText, title: file.title });
        await vi.waitFor(() => expect(useRecoveryStore.getState().offer).toBeDefined());
        restoreRecoveryDraft(useRecoveryStore.getState().offer!);
        expect(useProjectStore.getState().activeFile).toBeUndefined();
        expect(useWorkbenchStore.getState().tabs).toHaveLength(1);
        const result = await useProjectStore.getState().saveAllDirtyFiles();
        expect(result.saved).toEqual([file.path]);
        expect(mocks.write).toHaveBeenCalledWith(file.path, 'unsaved', { expectedContent: 'original' }, expect.any(Function));
        expect(readDrafts(disk)).toEqual([]);
    });

    it('shows unavailable files and preserves the earlier draft when persistence fails', async () => {
        const disk = storage();
        replaceDraft(disk, '/Game', [file]);
        mocks.read.mockRejectedValue(new Error('Permission denied'));
        stop = startRecoverySession(disk);
        useProjectStore.getState().setProject('/Game', []);
        await vi.waitFor(() => expect(useRecoveryStore.getState().offer?.files[0].diskError).toBe('Permission denied'));
        const originalWrite = disk.setItem;
        disk.setItem = () => { throw new Error('Quota exceeded'); };
        restoreRecoveryDraft(useRecoveryStore.getState().offer!);
        expect(useRecoveryStore.getState().error).toBe('Quota exceeded');
        expect(readDrafts(disk)[0].files[0].text).toBe('unsaved');
        disk.setItem = originalWrite;
    });

    it('keeps postponed drafts and discards only the chosen project', async () => {
        const disk = storage();
        replaceDraft(disk, '/Game', [file]);
        replaceDraft(disk, '/Other', [{ ...file, path: '/Other/intro.json' }]);
        stop = startRecoverySession(disk);
        useProjectStore.getState().setProject('/Game', []);
        await vi.waitFor(() => expect(useRecoveryStore.getState().offer).toBeDefined());
        keepRecoveryDraft();
        expect(readDrafts(disk)).toHaveLength(2);
        discardRecoveryDraft('/Game');
        expect(readDrafts(disk).map(draft => draft.projectPath)).toEqual(['/Other']);
    });

    it('preserves a postponed revision while protecting and saving new same-file edits', async () => {
        const disk = storage();
        replaceDraft(disk, '/Game', [file]);
        stop = startRecoverySession(disk);
        useProjectStore.getState().setProject('/Game', []);
        await vi.waitFor(() => expect(useRecoveryStore.getState().offer).toBeDefined());
        keepRecoveryDraft();
        useWorkbenchStore.getState().openOrFocusTab({ id: 'new', kind: 'text', path: file.path, savedTextContent: 'original', textContent: 'original', title: file.title });
        useWorkbenchStore.getState().updateTabContent('new', 'newer work');
        expect(readDrafts(disk).map(draft => draft.files[0].text)).toEqual(['unsaved', 'newer work']);
        useWorkbenchStore.getState().updateTabContent('new', 'newer work', { markDirty: false });
        expect(readDrafts(disk).map(draft => draft.files[0].text)).toEqual(['unsaved']);
    });

    it('does not offer another same-named project or apply a late disk read after a switch', async () => {
        const disk = storage();
        replaceDraft(disk, '/First/Game', [{ ...file, path: '/First/Game/intro.json' }]);
        let resolve!: (text: string) => void;
        mocks.read.mockReturnValue(new Promise<string>(done => { resolve = done; }));
        stop = startRecoverySession(disk);
        useProjectStore.getState().setProject('/First/Game', []);
        useProjectStore.getState().setProject('/Second/Game', []);
        resolve('original');
        await Promise.resolve();
        await Promise.resolve();
        expect(useRecoveryStore.getState().offer).toBeUndefined();
        expect(readDrafts(disk)).toHaveLength(1);
    });

    it('rejects obsolete offers and preserves newer unsaved edits', async () => {
        const disk = storage();
        replaceDraft(disk, '/Game', [file]);
        stop = startRecoverySession(disk);
        useProjectStore.getState().setProject('/Game', []);
        await vi.waitFor(() => expect(useRecoveryStore.getState().offer).toBeDefined());
        const offer = useRecoveryStore.getState().offer!;
        useWorkbenchStore.getState().openOrFocusTab({ id: 'new', kind: 'text', path: file.path, savedTextContent: 'original', textContent: 'original', title: file.title });
        useWorkbenchStore.getState().updateTabContent('new', 'newer');
        expect(restoreRecoveryDraft(offer)).toBe(false);
        expect(useWorkbenchStore.getState().tabs[0].textContent).toBe('newer');
        useProjectStore.getState().setProject('/Game', []);
        expect(restoreRecoveryDraft(offer)).toBe(false);
    });

    it('ignores malformed records and rejects escaping paths while retaining valid work', () => {
        const disk = storage();
        disk.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ drafts: [undefined, { files: [file, { ...file, path: '/Game/../Other/a.json' }, { text: 4 }], projectPath: '/Game', updatedAt: 1 }], version: 1 }));
        expect(readDrafts(disk)[0].files).toEqual([file]);
    });

    it('preserves unreadable data and the earlier revision when storage is full', () => {
        const disk = storage();
        disk.setItem(DRAFT_STORAGE_KEY, '{broken');
        stop = startRecoverySession(disk);
        expect(useRecoveryStore.getState().error).toBeDefined();
        expect(disk.getItem(DRAFT_STORAGE_KEY)).toBe('{broken');
        disk.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ drafts: [], version: 1 }));
        replaceDraft(disk, '/Game', [file]);
        expect(() => replaceDraft(disk, '/Game', [{ ...file, text: 'x'.repeat(MAX_DRAFT_BYTES) }])).toThrow('full');
        expect(readDrafts(disk)[0].files[0].text).toBe('unsaved');
    });

    it('cancels a folder reopen that completes after the app lifetime ends', async () => {
        const disk = storage();
        stop = startRecoverySession(disk);
        let resolve!: (value: boolean) => void;
        const restore = vi.spyOn(browserFsAdapter.recentProjects, 'restore').mockReturnValue(new Promise<boolean>(done => { resolve = done; }));
        const opening = openRecoveryProject('/Game');
        stop();
        stop = undefined;
        resolve(true);
        await expect(opening).resolves.toBe(false);
        expect(useProjectStore.getState().projectPath).toBeUndefined();
        restore.mockRestore();
    });

    it('suppresses disk read completion after unmount and captures nothing while disabled', async () => {
        const disk = storage();
        replaceDraft(disk, '/Game', [file]);
        let resolve!: (text: string) => void;
        mocks.read.mockReturnValue(new Promise<string>(done => { resolve = done; }));
        stop = startRecoverySession(disk);
        useProjectStore.getState().setProject('/Game', []);
        stop();
        stop = undefined;
        resolve('original');
        await Promise.resolve();
        await Promise.resolve();
        expect(useRecoveryStore.getState().offer).toBeUndefined();
        useSettingsStore.getState().setRecoveryEnabled(false);
        stop = startRecoverySession(disk);
        expect(useRecoveryStore.getState().offer).toBeUndefined();
    });
});

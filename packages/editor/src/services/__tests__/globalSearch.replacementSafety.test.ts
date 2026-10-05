import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProjectState } from '../../store/project/types';
import type { WorkbenchTab } from '../../store/workbench/types';

const mocks = vi.hoisted(() => ({
    applyMacros: vi.fn(), applyScript: vi.fn(),
    project: {} as ProjectState,
    read: vi.fn<(path: string) => Promise<string>>(),
    setSaved: vi.fn(),
    subscribe: vi.fn<(listener: (state: { tabs: WorkbenchTab[] }) => void) => () => void>(),
    tabs: [] as WorkbenchTab[],
    update: vi.fn(),
    write: vi.fn<(path: string, text: string, options?: { expectedContent?: string }) => Promise<void>>(),
}));
vi.mock('../../store/storeBootstrap', () => ({ useProjectStore: {
    getState: () => mocks.project,
    setState: (patch: Partial<ProjectState>) => { Object.assign(mocks.project, patch); },
} }));
vi.mock('../../store/useWorkbenchStore', () => ({ useWorkbenchStore: { getState: () => ({
    setTabSavedContent: mocks.setSaved, tabs: mocks.tabs, updateTabContent: mocks.update,
}), subscribe: mocks.subscribe } }));
vi.mock('../fs', () => ({ fsReadTextFile: mocks.read, fsWriteTextFile: mocks.write }));
vi.mock('../projectOpeners', () => ({ applyMacrosFile: mocks.applyMacros, applyScriptFile: mocks.applyScript }));

import { createGlobalSearchProjectData } from '../../test-utils/projectDataBuilder';
import { applySearchReplacement, prepareSearchReplacement, replacementStatus } from '../globalSearch/applyReplacement';
import { collectSearchMatches } from '../globalSearch/orchestration';
import { collectReplacementFiles } from '../globalSearch/replacementOrchestration';
import { replacementModelText } from '../globalSearch/replacementSource';
import { resolveGlobalSearchTextOptions } from '../globalSearch/textSearch';

vi.mock('../../plugins/commandPlugins', () => ({ getPlugin: () => ({}) }));

function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>(done => { resolve = done; });
    return { promise, resolve };
}

function fixture(kinds = ['scene', 'macro', 'character', 'item']) {
    const data = createGlobalSearchProjectData();
    mocks.project = { ...data, dirtyFiles: new Set(), projectGeneration: 1 } as ProjectState;
    mocks.subscribe.mockReturnValue(unsubscribe);
    const options = resolveGlobalSearchTextOptions({});
    const matches = collectSearchMatches('hero', data, options).filter(match => kinds.includes(match.kind));
    const files = collectReplacementFiles('hero', 'champion', matches, data, options);
    const disk = new Map(files.map(file => [file.filePath, replacementModelText(file, data)!]));
    mocks.tabs = files.map(file => ({ dirty: false, id: file.filePath, kind: 'json', path: file.filePath,
        savedTextContent: disk.get(file.filePath), textContent: disk.get(file.filePath), title: file.filePath }));
    mocks.read.mockImplementation(path => Promise.resolve(disk.get(path)!));
    mocks.write.mockImplementation((path, text, options) => {
        if (disk.get(path) !== options?.expectedContent) return Promise.reject(new Error('Disk conflict'));
        disk.set(path, text);
        return Promise.resolve();
    });
    mocks.update.mockImplementation((id: string, text: string) => {
        mocks.tabs = mocks.tabs.map(tab => tab.id === id ? { ...tab, dirty: false, savedTextContent: text, textContent: text } : tab);
        mocks.project.dirtyFiles.delete(id);
    });
    mocks.setSaved.mockImplementation((id: string, text: string) => {
        mocks.tabs = mocks.tabs.map(tab => tab.id === id ? { ...tab, savedTextContent: text } : tab);
    });
    return { data, disk, files };
}

function unsubscribe() {}

describe('search replacement write and draft safety', () => {
    beforeEach(() => { vi.resetAllMocks(); });

    it('writes and reconciles every supported kind without reloading unrelated content', async () => {
        const { data, disk, files } = fixture();
        const unrelated = { dirty: true, id: 'other', kind: 'text', path: '/project/other.txt', textContent: 'draft', title: 'other' } as WorkbenchTab;
        mocks.tabs.push(unrelated);
        mocks.project.dirtyFiles.add(unrelated.path);
        const result = await applySearchReplacement(await prepareSearchReplacement(files, data));
        expect(result).toEqual({ failed: [], saved: files.map(file => file.filePath), skipped: [] });
        for (const file of files) {
            expect(disk.get(file.filePath)).toContain('champion');
            expect(mocks.tabs.find(tab => tab.path === file.filePath)).toMatchObject({ dirty: false, savedTextContent: disk.get(file.filePath), textContent: disk.get(file.filePath) });
        }
        expect(mocks.project.characters.hero.displayName).toBe('champion');
        expect(mocks.project.items.badge.description).toBe('champion item');
        expect(mocks.project.macros.greet[0].text).toBe('hello champion');
        expect(mocks.project.scenes.intro[0].text).toBe('champion appears');
        expect(mocks.tabs.at(-1)).toBe(unrelated);
    });

    it.each(['tab', 'project', 'alias'])('blocks an affected dirty %s before any I/O', async kind => {
        const { data, files } = fixture(['scene']);
        if (kind === 'tab') mocks.tabs[0].dirty = true;
        else mocks.project.dirtyFiles.add(kind === 'alias' ? files[0].filePath.replaceAll('/', '\\') : files[0].filePath);
        await expect(prepareSearchReplacement(files, data)).rejects.toThrow('unsaved changes');
        expect(mocks.read).not.toHaveBeenCalled();
        expect(mocks.write).not.toHaveBeenCalled();
    });

    it('retains failed output and its newer dirty draft after another write succeeds', async () => {
        const { data, disk, files } = fixture(['character', 'scene']);
        const failed = files[1];
        const original = disk.get(failed.filePath);
        mocks.project.activeFile = failed.filePath;
        const write = mocks.write.getMockImplementation()!;
        mocks.write.mockImplementation(async (path, text, options) => {
            if (path === failed.filePath) {
                mocks.tabs[1] = { ...mocks.tabs[1], dirty: true, textContent: 'newer failed draft' };
                mocks.project.dirtyFiles.add(path);
                throw new Error('Permission denied');
            }
            await write(path, text, options);
        });
        const result = await applySearchReplacement(await prepareSearchReplacement(files, data));
        expect(result.saved).toEqual([files[0].filePath]);
        expect(result.failed).toEqual([{ filePath: failed.filePath, message: 'Permission denied' }]);
        expect(disk.get(failed.filePath)).toBe(original);
        expect(mocks.tabs[1]).toMatchObject({ dirty: true, savedTextContent: original, textContent: 'newer failed draft' });
        expect(mocks.project.dirtyFiles.has(failed.filePath)).toBe(true);
        expect(mocks.project.scenes.intro[0].text).toBe('hero appears');
        expect(mocks.applyScript).not.toHaveBeenCalled();
        expect(replacementStatus(result)).toContain('1 file(s).\nFailed:');
    });

    it('reports total failure without cleaning any tabs', async () => {
        const { data, files } = fixture();
        const tabs = [...mocks.tabs];
        mocks.write.mockRejectedValue(new Error('Failure'));
        const result = await applySearchReplacement(await prepareSearchReplacement(files, data));
        expect(result.saved).toEqual([]);
        expect(result.failed).toHaveLength(4);
        expect(mocks.tabs).toEqual(tabs);
        expect(mocks.update).not.toHaveBeenCalled();
    });

    it.each(['path', 'generation', 'owner'])('stops later writes and reconciliation after %s changes during a write', async kind => {
        const { data, files } = fixture(['character', 'scene']);
        let owner = true;
        const plan = await prepareSearchReplacement(files, data, () => owner);
        const gate = deferred();
        mocks.write.mockReturnValueOnce(gate.promise);
        const running = applySearchReplacement(plan);
        if (kind === 'path') mocks.project.projectPath = '/other';
        else if (kind === 'generation') mocks.project.projectGeneration += 1;
        else owner = false;
        gate.resolve();
        expect(await running).toMatchObject({ saved: [files[0].filePath], skipped: [files[1].filePath] });
        expect(mocks.write).toHaveBeenCalledTimes(1);
        if (kind === 'owner') expect(mocks.update).toHaveBeenCalledOnce();
        else expect(mocks.update).not.toHaveBeenCalled();
        expect(mocks.setSaved).not.toHaveBeenCalled();
    });

    it.each(['dirty', 'model', 'manifest', 'reopened'])('rejects a stale %s confirmation before writes', async kind => {
        const { data, files } = fixture(['scene']);
        const plan = await prepareSearchReplacement(files, data);
        switch (kind) {
        case 'dirty': {
        mocks.tabs[0] = { ...mocks.tabs[0], dirty: true, textContent: 'draft' };
        break;
        }
        case 'manifest': {
        mocks.project.manifest = { ...mocks.project.manifest! };
        break;
        }
        case 'model': {
        mocks.project.scenes = { intro: [{ text: 'changed', type: 'dialogue' }] };
        break;
        }
        default: { mocks.project.projectGeneration += 1;
        }
        }
        const result = await applySearchReplacement(plan);
        expect(result.saved).toEqual([]);
        expect(mocks.write).not.toHaveBeenCalled();
    });

    it('rejects dirty changes during source reads and a later read failure before any writes', async () => {
        const { data, files } = fixture(['scene']);
        const gate = deferred();
        mocks.read.mockImplementation(async () => { await gate.promise; return '[]'; });
        const running = prepareSearchReplacement(files, data);
        mocks.project.dirtyFiles.add(files[0].filePath);
        gate.resolve();
        await expect(running).rejects.toThrow('unsaved');
        expect(mocks.write).not.toHaveBeenCalled();
        const next = fixture();
        mocks.read.mockRejectedValueOnce(new Error('Unreadable source'));
        await expect(prepareSearchReplacement(next.files, next.data)).rejects.toThrow('Unreadable');
        expect(mocks.write).not.toHaveBeenCalled();
    });

    it('rejects in-place source model edits during a read', async () => {
        const { data, disk, files } = fixture(['scene']);
        const gate = deferred();
        mocks.read.mockImplementation(async path => { await gate.promise; return disk.get(path)!; });
        const running = prepareSearchReplacement(files, data);
        data.scenes.intro[0].text = 'in-place changed';
        gate.resolve();
        await expect(running).rejects.toThrow('Search content changed');
        expect(mocks.write).not.toHaveBeenCalled();
    });

    it('preserves edits made during a successful write while updating their disk baseline', async () => {
        const { data, files } = fixture(['scene']);
        mocks.project.activeFile = files[0].filePath;
        const plan = await prepareSearchReplacement(files, data);
        const gate = deferred();
        mocks.write.mockReturnValueOnce(gate.promise);
        const running = applySearchReplacement(plan);
        mocks.tabs[0] = { ...mocks.tabs[0], dirty: true, textContent: 'newer draft' };
        mocks.project.dirtyFiles.add(files[0].filePath);
        gate.resolve();
        const result = await running;
        expect(result.saved).toHaveLength(1);
        expect(mocks.tabs[0]).toMatchObject({ dirty: true, savedTextContent: plan.files[0].content, textContent: 'newer draft' });
        expect(mocks.applyScript).not.toHaveBeenCalled();
        expect(mocks.project.scenes.intro[0].text).toBe('hero appears');
    });

    it('checks later dirty files again after earlier writes', async () => {
        const { data, files } = fixture(['character', 'scene']);
        const plan = await prepareSearchReplacement(files, data);
        const write = mocks.write.getMockImplementation()!;
        mocks.write.mockImplementation(async (path, text, options) => {
            await write(path, text, options);
            mocks.project.dirtyFiles.add(files[1].filePath);
        });
        const result = await applySearchReplacement(plan);
        expect(result.saved).toEqual([files[0].filePath]);
        expect(result.failed[0].message).toContain('unsaved');
        expect(mocks.write).toHaveBeenCalledTimes(1);
    });

    it.each([false, true])('does not update a %s dirty tab closed and reopened during its write', async dirty => {
        const { data, files } = fixture(['scene']);
        mocks.project.activeFile = files[0].filePath;
        const plan = await prepareSearchReplacement(files, data);
        const gate = deferred();
        let notify!: (state: { tabs: WorkbenchTab[] }) => void;
        mocks.subscribe.mockImplementation(listener => { notify = listener; return unsubscribe; });
        mocks.write.mockReturnValueOnce(gate.promise);
        const running = applySearchReplacement(plan);
        const previous = mocks.tabs[0];
        mocks.tabs = [];
        notify({ tabs: mocks.tabs });
        const reopened = { ...previous, dirty, textContent: 'reopened draft' };
        mocks.tabs = [reopened];
        notify({ tabs: mocks.tabs });
        gate.resolve();
        await running;
        expect(mocks.tabs[0]).toBe(reopened);
        expect(mocks.update).not.toHaveBeenCalled();
        expect(mocks.setSaved).not.toHaveBeenCalled();
        expect(mocks.applyScript).not.toHaveBeenCalled();
    });

    it('detects external changes both before preparation and after confirmation', async () => {
        const { data, disk, files } = fixture(['scene']);
        disk.set(files[0].filePath, '[]');
        await expect(prepareSearchReplacement(files, data)).rejects.toThrow('Source changed');
        mocks.tabs = [];
        await expect(prepareSearchReplacement(files, data)).rejects.toThrow('Source changed');
        const next = fixture(['scene']);
        const plan = await prepareSearchReplacement(next.files, next.data);
        next.disk.set(next.files[0].filePath, '[]');
        const result = await applySearchReplacement(plan);
        expect(result.failed[0].message).toBe('Disk conflict');
        expect(next.disk.get(next.files[0].filePath)).toBe('[]');
        expect(mocks.update).not.toHaveBeenCalled();
    });

    it('preserves scene envelopes and macro metadata and refreshes the active script synchronously', async () => {
        const { data, disk, files } = fixture(['scene', 'macro']);
        for (const file of files) {
            const model = JSON.parse(disk.get(file.filePath)!) as unknown;
            disk.set(file.filePath, JSON.stringify(file.kind === 'scene' ? { commands: model, localeNamespace: 'intro', title: 'Keep title' } : { $schema: 'macro-schema', ...model as Record<string, unknown> }));
        }
        mocks.tabs = [];
        mocks.project.activeFile = '/project/scripts/intro.json';
        const plan = await prepareSearchReplacement(files, data);
        const result = await applySearchReplacement(plan);
        expect(result.saved).toHaveLength(2);
        expect(JSON.parse(disk.get('/project/scripts/intro.json')!)).toMatchObject({ localeNamespace: 'intro', title: 'Keep title' });
        expect(JSON.parse(disk.get('/project/data/macros.json')!)).toHaveProperty('$schema', 'macro-schema');
        expect(mocks.applyScript).toHaveBeenCalledOnce();
        expect(mocks.applyMacros).not.toHaveBeenCalled();
    });

    it('consumes confirmation once and prevents overlapping writes', async () => {
        const { data, files } = fixture(['scene']);
        const first = await prepareSearchReplacement(files, data);
        const second = await prepareSearchReplacement(files, data);
        const gate = deferred();
        mocks.write.mockReturnValueOnce(gate.promise);
        const running = applySearchReplacement(first);
        const duplicate = await applySearchReplacement(first);
        const overlap = await applySearchReplacement(second);
        expect(duplicate.saved).toEqual([]);
        expect(overlap.saved).toEqual([]);
        gate.resolve();
        await running;
        expect(mocks.write).toHaveBeenCalledTimes(1);
    });
});

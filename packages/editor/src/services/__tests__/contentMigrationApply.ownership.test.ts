import { describe, expect, it, vi } from 'vitest';

import type { ApplyContentMigrationPreviewDependencies, ContentMigrationPreviewResult } from '../contentMigrationPreview';

import { applyContentMigrationPreview } from '../contentMigrationPreview';
import { fsWriteTextFile } from '../fs/explorerFs';

const adapter = vi.hoisted(() => ({ writeTextFile: vi.fn() }));
vi.mock('../fs/browserFsAdapter', () => ({ browserFsAdapter: adapter }));
vi.mock('../fs/tauriFsAdapter', () => ({ tauriFsAdapter: {} }));
vi.mock('../runtime/runtimeEnvironment', () => ({ isTauriRuntime: () => false }));

function fixture() {
    const changes = ['game.json', 'intro.json', 'ending.json'].map((name, index) => ({ after: `new-${index}`, before: `old-${index}`, path: `/A/${name}`, type: 'scene' as const }));
    const preview: ContentMigrationPreviewResult = { changes, manifestPath: '/A/game.json', projectPath: '/A' };
    const disk = new Map(changes.map(change => [change.path, change.before]));
    const writes = vi.fn<ApplyContentMigrationPreviewDependencies['writeTextFile']>((path, content, options, isCurrent) => {
        if (isCurrent && !isCurrent()) throw new Error('Retired');
        if (disk.get(path) !== options?.expectedContent) throw new Error('File changed on disk. Reopen it before saving.');
        disk.set(path, content);
        return Promise.resolve();
    });
    const read = vi.fn((path: string) => Promise.resolve(disk.get(path)!));
    return { disk, preview, read, writes };
}

describe('migration write protection and progress', () => {
    it('passes captured bytes and ownership to every protected write', async () => {
        const f = fixture();
        const current = vi.fn(() => true);
        const result = await applyContentMigrationPreview(f.preview, { isCurrent: current }, { readTextFile: f.read, writeTextFile: f.writes });
        expect(result.written).toEqual(f.preview.changes);
        for (const change of f.preview.changes) expect(f.writes).toHaveBeenCalledWith(change.path, change.after, { expectedContent: change.before }, current);
    });

    it.each(['browser', 'native'] as const)('preserves a %s conflict after preflight', async mode => {
        const f = fixture();
        f.writes.mockImplementationOnce(path => {
            f.disk.set(path, 'external edit');
            return Promise.reject(mode === 'native' ? Object.assign(new Error('File was removed after it was read'), { code: 'stale' }) : new Error('File changed on disk. Reopen it before saving.'));
        });
        const result = await applyContentMigrationPreview(f.preview, {}, { readTextFile: f.read, writeTextFile: f.writes });
        expect(result.conflicts).toEqual([f.preview.changes[0]]);
        expect(result.written).toEqual(f.preview.changes.slice(1));
        expect(f.disk.get('/A/game.json')).toBe('external edit');
    });

    it.each([0, 1, 2])('retains accurate partial progress when write %s fails', async failedIndex => {
        const f = fixture();
        const original = f.writes.getMockImplementation()!;
        f.writes.mockImplementation(async (...arguments_) => {
            if (arguments_[0] === f.preview.changes[failedIndex].path) throw new Error('Permission denied');
            return original(...arguments_);
        });
        const result = await applyContentMigrationPreview(f.preview, {}, { readTextFile: f.read, writeTextFile: f.writes });
        expect(result.written).toEqual(f.preview.changes.slice(0, failedIndex));
        expect(result.failures).toEqual([{ change: f.preview.changes[failedIndex], message: 'Permission denied' }]);
        expect(result.skipped).toEqual(f.preview.changes.slice(failedIndex + 1));
        for (const change of f.preview.changes.slice(failedIndex)) expect(f.disk.get(change.path)).toBe(change.before);
    });

    it('retains earlier writes and stops after a read failure', async () => {
        const f = fixture();
        f.read.mockResolvedValueOnce('old-0').mockRejectedValueOnce(new Error('Cannot read scene'));
        const result = await applyContentMigrationPreview(f.preview, {}, { readTextFile: f.read, writeTextFile: f.writes });
        expect(result.written).toEqual(f.preview.changes.slice(0, 1));
        expect(result.failures?.[0]?.message).toBe('Cannot read scene');
        expect(result.skipped).toEqual(f.preview.changes.slice(2));
    });

    it('retires during a successful write while retaining its receipt and skipping following writes', async () => {
        const f = fixture();
        let active = true;
        f.writes.mockImplementationOnce((path, content) => { f.disk.set(path, content); active = false; return Promise.resolve(); });
        const result = await applyContentMigrationPreview(f.preview, { isCurrent: () => active }, { readTextFile: f.read, writeTextFile: f.writes });
        expect(result.retired).toBe(true);
        expect(result.written).toEqual(f.preview.changes.slice(0, 1));
        expect(result.skipped).toEqual(f.preview.changes.slice(1));
        expect(f.writes).toHaveBeenCalledOnce();
    });

    it('retires during preflight without writing or reporting an obsolete error', async () => {
        const f = fixture();
        let active = true;
        f.read.mockImplementationOnce(() => { active = false; return Promise.reject(new Error('Obsolete read failure')); });
        const result = await applyContentMigrationPreview(f.preview, { isCurrent: () => active }, { readTextFile: f.read, writeTextFile: f.writes });
        expect(result).toEqual({ conflicts: [], retired: true, skipped: f.preview.changes, written: [] });
        expect(f.writes).not.toHaveBeenCalled();
    });

    it('rechecks ownership when an actual filesystem write leaves its queue', async () => {
        const f = fixture();
        let release!: () => void;
        const blocked = new Promise<void>(resolve => { release = resolve; });
        adapter.writeTextFile.mockImplementationOnce(() => blocked);
        const first = fsWriteTextFile('/A/game.json', 'held');
        await vi.waitFor(() => expect(adapter.writeTextFile).toHaveBeenCalled());
        let active = true;
        const pending = applyContentMigrationPreview({ ...f.preview, changes: f.preview.changes.slice(0, 1) }, { isCurrent: () => active }, { readTextFile: f.read, writeTextFile: fsWriteTextFile });
        await vi.waitFor(() => expect(f.read).toHaveBeenCalledOnce());
        active = false;
        release();
        await first;
        const result = await pending;
        expect(result.retired).toBe(true);
        expect(adapter.writeTextFile).toHaveBeenCalledOnce();
        adapter.writeTextFile.mockReset();
    });
});

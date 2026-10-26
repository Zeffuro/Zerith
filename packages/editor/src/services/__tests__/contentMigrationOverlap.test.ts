import { describe, expect, it, vi } from 'vitest';

import type { ProjectState } from '../../store/project/types';
import type { ContentMigrationPreviewResult } from '../contentMigrationPreview';
import type { FsTextWriteOptions } from '../fs/types';

import { executeContentMigrationCommand } from '../contentMigrationCommand';
import { applyContentMigrationPreview } from '../contentMigrationPreview';
import { createContentMigrationRunner } from '../contentMigrationRun';
import { fsWriteTextFile } from '../fs/explorerFs';

const adapter = vi.hoisted(() => ({ writeTextFile: vi.fn() }));
vi.mock('../fs/browserFsAdapter', () => ({ browserFsAdapter: adapter }));
vi.mock('../fs/tauriFsAdapter', () => ({ tauriFsAdapter: {} }));
vi.mock('../runtime/runtimeEnvironment', () => ({ isTauriRuntime: () => false }));
vi.mock('../../store/storeBootstrap', () => ({ useProjectStore: { getState: vi.fn() } }));
vi.mock('../../store/useEditorStore', () => ({ useEditorStore: { getState: vi.fn() } }));
vi.mock('../../store/actions/consoleMessageActions', () => ({ executeConsoleMessageAction: vi.fn() }));

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(complete => { resolve = complete; });
    return { promise, resolve };
}

describe('content migration queued overlap', () => {
    it('refreshes the current session when a superseded in-flight write conflicts with its successor preview', async () => {
        const path = '/overlap/game.json';
        const disk = new Map([[path, 'old']]);
        const gate = deferred<void>();
        const committed = deferred<void>();
        const confirmation = deferred<boolean>();
        const readTextFile = vi.fn((file: string) => Promise.resolve(disk.get(file)!));
        adapter.writeTextFile.mockImplementation(async (file: string, content: string, options: FsTextWriteOptions) => {
            if (disk.get(file) !== options.expectedContent) throw new Error('File changed on disk. Reopen it before saving.');
            await gate.promise;
            disk.set(file, content);
            committed.resolve();
        });
        const preview = vi.fn(() => {
            const before = disk.get(path)!;
            return Promise.resolve<ContentMigrationPreviewResult>({
                changes: [{ after: 'migrated', before, path, type: 'manifest' }], manifestPath: path, projectPath: '/overlap',
            });
        });
        const confirm = vi.fn<() => boolean | Promise<boolean>>(() => true).mockReturnValueOnce(true).mockReturnValueOnce(confirmation.promise);
        const log = vi.fn();
        const announce = vi.fn();
        const project: Pick<ProjectState, 'dirtyFiles' | 'loadManifest' | 'projectGeneration' | 'projectPath' | 'saveAllDirtyFiles'> = {
            dirtyFiles: new Set(), loadManifest: vi.fn(() => Promise.resolve(true)), projectGeneration: 1, projectPath: '/overlap',
            saveAllDirtyFiles: vi.fn(() => Promise.resolve({ failed: [], saved: [], skipped: [] })),
        };
        const runner = createContentMigrationRunner({
            announce,
            execute: (root, isCurrent) => executeContentMigrationCommand(root, {
                applyPreview: (value, options) => applyContentMigrationPreview(value, options, { readTextFile, writeTextFile: fsWriteTextFile }),
                confirm, log, preview,
            }, isCurrent),
            getProject: () => project,
            markManualSave: vi.fn(),
        });
        const session = { projectGeneration: 1, projectPath: '/overlap' };
        const old = runner.runSaved(session);
        await vi.waitFor(() => expect(adapter.writeTextFile).toHaveBeenCalledOnce());
        const current = runner.runSaved(session);
        await vi.waitFor(() => expect(confirm).toHaveBeenCalledTimes(2));
        await expect(preview.mock.results[1]?.value).resolves.toMatchObject({ changes: [{ before: 'old' }] });
        expect(await old).toEqual({ status: 'retired' });
        gate.resolve();
        await committed.promise;
        confirmation.resolve(true);
        const result = await current;
        expect(result.status).toBe('conflicted');
        if (result.status !== 'conflicted') throw new Error('The successor must retain its stale-preview conflict receipt.');
        expect(result.application.written).toEqual([]);
        expect(result.application.conflicts).toHaveLength(1);
        expect(disk.get(path)).toBe('migrated');
        expect(adapter.writeTextFile).toHaveBeenCalledOnce();
        expect(project.loadManifest).toHaveBeenCalledOnce();
        expect(announce).toHaveBeenLastCalledWith('Content migration wrote 0 file(s), but 1 file(s) changed after preview.', 'warning');
        expect(log.mock.calls.some(call => String(call[2]).includes('applied 1 file'))).toBe(false);
        adapter.writeTextFile.mockReset();
    });
});

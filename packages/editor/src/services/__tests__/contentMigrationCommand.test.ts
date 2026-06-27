import { describe, expect, it, vi } from 'vitest';

import type { ContentMigrationPreviewResult } from '../contentMigrationPreview';

import { executeContentMigrationCommand } from '../contentMigrationCommand';

function previewWithChanges(): ContentMigrationPreviewResult {
    return {
        changes: [
            {
                after: '{"schemaVersion":2}\n',
                before: '{}',
                path: '/project/game.json',
                type: 'manifest',
            },
        ],
        manifestPath: '/project/game.json',
        projectPath: '/project',
    };
}

describe('contentMigrationCommand', () => {
    it('warns when no project is open', async () => {
        const log = vi.fn();

        const result = await executeContentMigrationCommand(undefined, {
            applyPreview: vi.fn(),
            confirm: vi.fn(),
            log,
            preview: vi.fn(),
        });

        expect(result).toEqual({ status: 'no-project' });
        expect(log).toHaveBeenCalledWith('editor', 'warn', 'Content migration requires an open project.');
    });

    it('reports no-change previews without prompting', async () => {
        const log = vi.fn();
        const confirm = vi.fn();
        const preview: ContentMigrationPreviewResult = {
            changes: [],
            manifestPath: '/project/game.json',
            projectPath: '/project',
        };

        const result = await executeContentMigrationCommand('/project', {
            applyPreview: vi.fn(),
            confirm,
            log,
            preview: vi.fn(() => Promise.resolve(preview)),
        });

        expect(result).toEqual({ preview, status: 'no-changes' });
        expect(confirm).not.toHaveBeenCalled();
        expect(log).toHaveBeenCalledWith('editor', 'info', 'Content migration preview found no changes.');
    });

    it('prompts and cancels without applying', async () => {
        const log = vi.fn();
        const applyPreview = vi.fn();
        const preview = previewWithChanges();

        const result = await executeContentMigrationCommand('/project', {
            applyPreview,
            confirm: vi.fn(() => false),
            log,
            preview: vi.fn(() => Promise.resolve(preview)),
        });

        expect(result).toEqual({ preview, status: 'cancelled' });
        expect(applyPreview).not.toHaveBeenCalled();
        expect(log).toHaveBeenCalledWith('editor', 'info', 'Content migration cancelled.');
    });

    it('applies accepted previews and reports written files', async () => {
        const log = vi.fn();
        const preview = previewWithChanges();
        const application = {
            conflicts: [],
            skipped: [],
            written: preview.changes,
        };

        const result = await executeContentMigrationCommand('/project', {
            applyPreview: vi.fn(() => Promise.resolve(application)),
            confirm: vi.fn(() => true),
            log,
            preview: vi.fn(() => Promise.resolve(preview)),
        });

        expect(result).toEqual({ application, preview, status: 'applied' });
        expect(log).toHaveBeenCalledWith('editor', 'info', 'Content migration applied 1 file(s).');
    });

    it('reports stale-file conflicts after accepted previews', async () => {
        const log = vi.fn();
        const preview = previewWithChanges();
        const application = {
            conflicts: preview.changes,
            skipped: [],
            written: [],
        };

        const result = await executeContentMigrationCommand('/project', {
            applyPreview: vi.fn(() => Promise.resolve(application)),
            confirm: vi.fn(() => true),
            log,
            preview: vi.fn(() => Promise.resolve(preview)),
        });

        expect(result).toEqual({ application, preview, status: 'conflicted' });
        expect(log).toHaveBeenCalledWith(
            'editor',
            'warn',
            'Content migration wrote 0 file(s), but 1 file(s) changed after preview:',
            '/project/game.json',
        );
    });
});

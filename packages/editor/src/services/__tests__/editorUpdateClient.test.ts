import { describe, expect, it, vi } from 'vitest';

import {
    formatEditorUpdateFlowResult,
    formatEditorUpdateInstallPrompt,
    getEditorUpdateFlowResultTone,
    runEditorUpdateCheck,
} from '../editorUpdateClient';

describe('runEditorUpdateCheck', () => {
    it('reports unsupported outside the desktop runtime', async () => {
        await expect(runEditorUpdateCheck({ isDesktopRuntime: () => false })).resolves.toEqual({ status: 'unsupported' });
    });

    it('reports up-to-date when no update is returned', async () => {
        await expect(runEditorUpdateCheck({
            check: () => Promise.resolve(undefined),
            isDesktopRuntime: () => true,
        })).resolves.toEqual({ status: 'up-to-date' });
    });

    it('closes an available update when install is declined', async () => {
        const close = vi.fn(() => Promise.resolve());

        await expect(runEditorUpdateCheck({
            check: () => Promise.resolve({
                close,
                currentVersion: '0.1.0',
                downloadAndInstall: vi.fn(),
                version: '0.1.1',
            }),
            confirmInstall: () => false,
            isDesktopRuntime: () => true,
        })).resolves.toEqual({ status: 'available', version: '0.1.1' });
        expect(close).toHaveBeenCalledTimes(1);
    });

    it('downloads, installs, and relaunches an accepted update', async () => {
        const relaunch = vi.fn(() => Promise.resolve());
        const progress = vi.fn();

        const result = await runEditorUpdateCheck({
            check: () => Promise.resolve({
                currentVersion: '0.1.0',
                downloadAndInstall: (onEvent) => {
                    onEvent?.({ data: { contentLength: 12 }, event: 'Started' });
                    onEvent?.({ data: { chunkLength: 5 }, event: 'Progress' });
                    onEvent?.({ data: { chunkLength: 7 }, event: 'Progress' });
                    onEvent?.({ event: 'Finished' });
                    return Promise.resolve();
                },
                version: '0.1.1',
            }),
            confirmInstall: () => true,
            isDesktopRuntime: () => true,
            onProgress: progress,
            relaunch,
        });

        expect(result).toEqual({
            downloadedBytes: 12,
            status: 'installed',
            totalBytes: 12,
            version: '0.1.1',
        });
        expect(relaunch).toHaveBeenCalledTimes(1);
        expect(progress).toHaveBeenLastCalledWith({ downloadedBytes: 12, totalBytes: 12 });
    });
});

describe('editor update result formatting', () => {
    it('formats user-facing update results', () => {
        expect(formatEditorUpdateFlowResult({ status: 'up-to-date' })).toBe('Zerith Editor is up to date.');
        expect(getEditorUpdateFlowResultTone({ status: 'unsupported' })).toBe('warning');
    });

    it('formats the install confirmation prompt with release notes when present', () => {
        expect(formatEditorUpdateInstallPrompt({
            body: 'Fixes updater confirmation.',
            version: '0.1.2',
        })).toContain('Fixes updater confirmation.');
    });
});

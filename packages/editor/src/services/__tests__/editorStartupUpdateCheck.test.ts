import { describe, expect, it, vi } from 'vitest';

import {
    type EditorStartupUpdateCheckDeps,
    runStartupEditorUpdateCheck,
} from '../editorStartupUpdateCheck';

type StartupRunUpdateCheckDeps = Parameters<EditorStartupUpdateCheckDeps['runUpdateCheck']>[0];

describe('runStartupEditorUpdateCheck', () => {
    it('skips when startup update checks are disabled', async () => {
        const runUpdateCheck = vi.fn();

        await expect(runStartupEditorUpdateCheck({
            announceOperationStatus: vi.fn(),
            checkForUpdatesOnStartup: false,
            confirmInstall: vi.fn(),
            isDesktopRuntime: () => true,
            runUpdateCheck,
        })).resolves.toEqual({ status: 'skipped' });

        expect(runUpdateCheck).not.toHaveBeenCalled();
    });

    it('skips silently outside the desktop runtime', async () => {
        const announceOperationStatus = vi.fn();
        const runUpdateCheck = vi.fn();

        await expect(runStartupEditorUpdateCheck({
            announceOperationStatus,
            checkForUpdatesOnStartup: true,
            confirmInstall: vi.fn(),
            isDesktopRuntime: () => false,
            runUpdateCheck,
        })).resolves.toEqual({ status: 'skipped' });

        expect(announceOperationStatus).not.toHaveBeenCalled();
        expect(runUpdateCheck).not.toHaveBeenCalled();
    });

    it('keeps up-to-date startup checks quiet', async () => {
        const announceOperationStatus = vi.fn();
        const runUpdateCheck = vi.fn(() => Promise.resolve({ status: 'up-to-date' as const }));

        await expect(runStartupEditorUpdateCheck({
            announceOperationStatus,
            checkForUpdatesOnStartup: true,
            confirmInstall: vi.fn(),
            isDesktopRuntime: () => true,
            runUpdateCheck,
        })).resolves.toEqual({ status: 'up-to-date' });

        expect(announceOperationStatus).not.toHaveBeenCalled();
    });

    it('announces when an update is available but not installed', async () => {
        const announceOperationStatus = vi.fn();
        const confirmInstall = vi.fn(() => false);
        const runUpdateCheck = vi.fn(() => Promise.resolve({ status: 'available' as const, version: '0.1.4' }));

        await expect(runStartupEditorUpdateCheck({
            announceOperationStatus,
            checkForUpdatesOnStartup: true,
            confirmInstall,
            isDesktopRuntime: () => true,
            runUpdateCheck,
        })).resolves.toEqual({ status: 'available', version: '0.1.4' });

        expect(runUpdateCheck).toHaveBeenCalledWith(expect.objectContaining({ confirmInstall }));
        expect(announceOperationStatus).toHaveBeenCalledWith('Zerith Editor 0.1.4 is available. Install skipped.', 'info');
    });

    it('announces install progress and installed results', async () => {
        const announceOperationStatus = vi.fn();
        const runUpdateCheck = vi.fn((deps: StartupRunUpdateCheckDeps) => {
            deps?.onProgress?.({ downloadedBytes: 5, totalBytes: 10 });
            deps?.onProgress?.({ downloadedBytes: 5, totalBytes: 10 });
            deps?.onProgress?.({ downloadedBytes: 10, totalBytes: 10 });
            return Promise.resolve({
                downloadedBytes: 10,
                status: 'installed' as const,
                totalBytes: 10,
                version: '0.1.4',
            });
        });

        await expect(runStartupEditorUpdateCheck({
            announceOperationStatus,
            checkForUpdatesOnStartup: true,
            confirmInstall: vi.fn(() => true),
            isDesktopRuntime: () => true,
            runUpdateCheck,
        })).resolves.toEqual({
            downloadedBytes: 10,
            status: 'installed',
            totalBytes: 10,
            version: '0.1.4',
        });

        expect(announceOperationStatus).toHaveBeenNthCalledWith(1, 'Downloading editor update... 50%');
        expect(announceOperationStatus).toHaveBeenNthCalledWith(2, 'Downloading editor update... 100%');
        expect(announceOperationStatus).toHaveBeenNthCalledWith(3, 'Installed Zerith Editor 0.1.4. Restarting...', 'success');
    });

    it('logs startup update check failures without throwing', async () => {
        const logger = { warn: vi.fn() };
        const error = new Error('network failed');

        await expect(runStartupEditorUpdateCheck({
            announceOperationStatus: vi.fn(),
            checkForUpdatesOnStartup: true,
            confirmInstall: vi.fn(),
            isDesktopRuntime: () => true,
            logger,
            runUpdateCheck: vi.fn(() => Promise.reject(error)),
        })).resolves.toEqual({ status: 'failed' });

        expect(logger.warn).toHaveBeenCalledWith('Editor startup update check failed:', error);
    });
});

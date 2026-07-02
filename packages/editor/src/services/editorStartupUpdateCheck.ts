import type { OperationStatusTone } from '../store/editor/types';

import {
    type EditorUpdateClientDeps,
    type EditorUpdateFlowResult,
    type EditorUpdateProgress,
    formatEditorUpdateFlowResult,
    getEditorUpdateFlowResultTone,
} from './editorUpdateClient';

export type EditorStartupUpdateCheckDeps = {
    announceOperationStatus: (message: string, tone?: OperationStatusTone) => void;
    checkForUpdatesOnStartup: boolean;
    confirmInstall: NonNullable<EditorUpdateClientDeps['confirmInstall']>;
    isDesktopRuntime: () => boolean;
    logger?: Pick<Console, 'warn'>;
    runUpdateCheck: (deps?: Pick<EditorUpdateClientDeps, 'confirmInstall' | 'isDesktopRuntime' | 'onProgress'>) => Promise<EditorUpdateFlowResult>;
};

export type EditorStartupUpdateCheckResult =
    | {
        status: 'failed';
    }
    | {
        status: 'skipped';
    }
    | EditorUpdateFlowResult;

export async function runStartupEditorUpdateCheck({
    announceOperationStatus,
    checkForUpdatesOnStartup,
    confirmInstall,
    isDesktopRuntime,
    logger = console,
    runUpdateCheck,
}: EditorStartupUpdateCheckDeps): Promise<EditorStartupUpdateCheckResult> {
    if (!checkForUpdatesOnStartup || !isDesktopRuntime()) {
        return { status: 'skipped' };
    }

    try {
        const result = await runUpdateCheck({
            confirmInstall,
            isDesktopRuntime,
            onProgress: createStartupUpdateProgressAnnouncer(announceOperationStatus),
        });

        if (result.status === 'available' || result.status === 'installed') {
            announceOperationStatus(formatEditorUpdateFlowResult(result), getEditorUpdateFlowResultTone(result));
        }

        return result;
    } catch (error) {
        logger.warn('Editor startup update check failed:', error);
        return { status: 'failed' };
    }
}

function createStartupUpdateProgressAnnouncer(
    announceOperationStatus: (message: string, tone?: OperationStatusTone) => void,
): (progress: EditorUpdateProgress) => void {
    let lastPercent: number | undefined;

    return (progress) => {
        if (!progress.totalBytes || progress.totalBytes <= 0) {
            announceOperationStatus('Downloading editor update...');
            return;
        }

        const percent = Math.min(100, Math.round((progress.downloadedBytes / progress.totalBytes) * 100));
        if (percent === lastPercent) return;
        lastPercent = percent;
        announceOperationStatus(`Downloading editor update... ${percent}%`);
    };
}

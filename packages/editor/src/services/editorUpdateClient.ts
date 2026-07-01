import { relaunch as tauriRelaunch } from '@tauri-apps/plugin-process';
import { type DownloadEvent, check as tauriCheck } from '@tauri-apps/plugin-updater';

import { isTauriRuntime } from './runtime/runtimeEnvironment';

export type EditorUpdateClientDeps = {
    check?: () => Promise<EditorUpdate | null | undefined>;
    confirmInstall?: (update: EditorUpdate) => boolean | Promise<boolean>;
    isDesktopRuntime?: () => boolean;
    onProgress?: (progress: EditorUpdateProgress) => void;
    relaunch?: () => Promise<void>;
};

export type EditorUpdateFlowResult =
    | {
        downloadedBytes: number;
        status: 'installed';
        totalBytes?: number;
        version: string;
    }
    | {
        status: 'available';
        version: string;
    }
    | {
        status: 'unsupported';
    }
    | {
        status: 'up-to-date';
    };

export type EditorUpdateProgress = {
    downloadedBytes: number;
    totalBytes?: number;
};

type EditorUpdate = {
    body?: string;
    close?: () => Promise<void>;
    currentVersion: string;
    date?: string;
    downloadAndInstall: (onEvent?: (event: DownloadEvent) => void) => Promise<void>;
    version: string;
};

export function formatEditorUpdateFlowResult(result: EditorUpdateFlowResult): string {
    switch (result.status) {
        case 'available': {
            return `Zerith Editor ${result.version} is available. Install skipped.`;
        }

        case 'installed': {
            return `Installed Zerith Editor ${result.version}. Restarting...`;
        }

        case 'unsupported': {
            return 'Editor updates are only available in the desktop app.';
        }

        case 'up-to-date': {
            return 'Zerith Editor is up to date.';
        }
    }
}

export function getEditorUpdateFlowResultTone(result: EditorUpdateFlowResult): 'error' | 'info' | 'success' | 'warning' {
    if (result.status === 'up-to-date' || result.status === 'installed') return 'success';
    if (result.status === 'unsupported') return 'warning';
    return 'info';
}

export async function runEditorUpdateCheck(deps: EditorUpdateClientDeps = {}): Promise<EditorUpdateFlowResult> {
    const isDesktopRuntime = deps.isDesktopRuntime ?? isTauriRuntime;
    if (!isDesktopRuntime()) {
        return { status: 'unsupported' };
    }

    const check = deps.check ?? tauriCheck;
    const update = await check();
    if (!update) {
        return { status: 'up-to-date' };
    }

    const shouldInstall = await (deps.confirmInstall ?? confirmInstallByDefault)(update);
    if (!shouldInstall) {
        await update.close?.();
        return { status: 'available', version: update.version };
    }

    let downloadedBytes = 0;
    let totalBytes: number | undefined;
    await update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
            totalBytes = event.data.contentLength;
            deps.onProgress?.({ downloadedBytes, totalBytes });
            return;
        }

        if (event.event === 'Progress') {
            downloadedBytes += event.data.chunkLength;
            deps.onProgress?.({ downloadedBytes, totalBytes });
            return;
        }

        deps.onProgress?.({ downloadedBytes, totalBytes });
    });

    await (deps.relaunch ?? tauriRelaunch)();
    return { downloadedBytes, status: 'installed', totalBytes, version: update.version };
}

function confirmInstallByDefault(update: EditorUpdate): boolean {
    const confirm_ = globalThis.confirm;
    if (typeof confirm_ !== 'function') return false;

    const notes = update.body ? `\n\n${update.body}` : '';
    return confirm_(`Install Zerith Editor ${update.version} now? The editor will restart after installation.${notes}`);
}

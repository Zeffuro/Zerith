import { relaunch as tauriRelaunch } from '@tauri-apps/plugin-process';
import { type DownloadEvent, check as tauriCheck } from '@tauri-apps/plugin-updater';

import {
    type EditorReleaseNote,
    loadEditorReleaseNoteForVersion,
    type LoadEditorReleaseNotesDeps,
} from './editorReleaseNotes';
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

export type EditorUpdateInstallPromptDeps = {
    releaseNotesTimeoutMs?: number;
} & LoadEditorReleaseNotesDeps;

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
    rawJson?: Record<string, unknown>;
    version: string;
};

export async function createEditorUpdateInstallPrompt(
    update: Pick<EditorUpdate, 'body' | 'rawJson' | 'version'>,
    deps: EditorUpdateInstallPromptDeps = {},
): Promise<string> {
    const releaseNote = await loadEditorReleaseNoteForVersionWithTimeout(update.version, deps);
    return formatEditorUpdateInstallPrompt({
        ...update,
        body: releaseNote?.body ?? readUpdateBody(update),
    });
}

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

export function formatEditorUpdateInstallPrompt(update: Pick<EditorUpdate, 'body' | 'rawJson' | 'version'>): string {
    const notes = formatEditorUpdatePromptNotes(readUpdateBody(update));
    const notesHeading = notes ? 'Changes in this release:' : undefined;
    const notesBlock = notesHeading && notes ? ['', notesHeading, notes] : [];

    return [
        `Zerith Editor ${update.version} is available.`,
        '',
        'Install it now? The editor will restart after installation.',
        ...notesBlock,
    ].join('\n');
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

    return confirm_(formatEditorUpdateInstallPrompt(update));
}

function formatEditorUpdatePromptNotes(value: string | undefined): string | undefined {
    const notes = value
        ?.replaceAll('\r\n', '\n')
        .replaceAll(/\*\*(.*?)\*\*/gu, '$1')
        .trim();

    if (!notes) return undefined;

    const maxLength = 1200;
    return notes.length > maxLength
        ? `${notes.slice(0, maxLength).trimEnd()}\n...`
        : notes;
}

async function loadEditorReleaseNoteForVersionWithTimeout(
    version: string,
    deps: EditorUpdateInstallPromptDeps,
): Promise<EditorReleaseNote | undefined> {
    const timeoutMs = deps.releaseNotesTimeoutMs ?? 2500;
    if (timeoutMs <= 0) return loadEditorReleaseNoteForVersion(version, deps);

    let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;
    const timeout = new Promise<void>((resolve) => {
        timeoutId = globalThis.setTimeout(resolve, timeoutMs);
    });

    try {
        return await Promise.race([
            loadEditorReleaseNoteForVersion(version, deps),
            timeout,
        ]) as EditorReleaseNote | undefined;
    } finally {
        if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId);
    }
}

function readUpdateBody(update: Pick<EditorUpdate, 'body' | 'rawJson'>): string | undefined {
    const rawNotes = update.rawJson?.notes;
    const rawBody = update.rawJson?.body;
    if (typeof update.body === 'string' && update.body.trim()) return update.body;
    if (typeof rawNotes === 'string' && rawNotes.trim()) return rawNotes;
    if (typeof rawBody === 'string' && rawBody.trim()) return rawBody;
    return undefined;
}

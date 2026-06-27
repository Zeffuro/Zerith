import { isTauriRuntime } from './runtimeEnvironment';

export type EditorCloseRequestedEvent = {
    preventDefault: () => void;
};

let openerApiPromise: Promise<typeof import('@tauri-apps/plugin-opener')> | undefined;
let tauriWindowApiPromise: Promise<typeof import('@tauri-apps/api/window')> | undefined;
let tauriWebviewWindowApiPromise: Promise<typeof import('@tauri-apps/api/webviewWindow')> | undefined;

const STARTUP_PROJECT_MANIFEST_QUERY_PARAM = 'projectManifest';

export function buildEditorStartupUrl(manifestPath: string): string {
    const parameters = new URLSearchParams({
        [STARTUP_PROJECT_MANIFEST_QUERY_PARAM]: manifestPath,
    });

    if (isTauriRuntime()) {
        return `/?${parameters.toString()}`;
    }

    const url = new URL(globalThis.location.href);
    url.searchParams.set(STARTUP_PROJECT_MANIFEST_QUERY_PARAM, manifestPath);
    return `${url.pathname}${url.search}${url.hash}`;
}

export function clearStartupProjectManifestPath(): void {
    try {
        const url = new URL(globalThis.location.href);
        url.searchParams.delete(STARTUP_PROJECT_MANIFEST_QUERY_PARAM);
        const nextLocation = `${url.pathname}${url.search}${url.hash}`;
        globalThis.history.replaceState(undefined, '', nextLocation);
    } catch {
        // URL cleanup is cosmetic; startup opening should not depend on it.
    }
}

export async function closeEditorWindow(): Promise<void> {
    if (!isTauriRuntime()) {
        globalThis.close?.();
        return;
    }

    const { getCurrentWindow } = await getTauriWindowApi();
    const appWindow = getCurrentWindow();

    try {
        await appWindow.close();
    } catch (error: unknown) {
        try {
            await appWindow.destroy();
        } catch (destroyError: unknown) {
            const closeMessage = error instanceof Error ? error.message : String(error);
            const destroyMessage = destroyError instanceof Error ? destroyError.message : String(destroyError);
            throw new Error(`Close failed: ${closeMessage}. Destroy failed: ${destroyMessage}`, { cause: destroyError });
        }
    }
}

export function getStartupProjectManifestPath(search = globalThis.location.search): string | undefined {
    const parameters = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    const manifestPath = parameters.get(STARTUP_PROJECT_MANIFEST_QUERY_PARAM)?.trim();
    return manifestPath || undefined;
}

export async function onEditorWindowCloseRequested(
    handler: (event: EditorCloseRequestedEvent) => void,
): Promise<() => void> {
    if (!isTauriRuntime()) return () => {};

    const { getCurrentWindow } = await getTauriWindowApi();
    return getCurrentWindow().onCloseRequested(handler);
}

export async function openExternalUrl(url: string): Promise<void> {
    if (isTauriRuntime()) {
        try {
            const { openUrl } = await getOpenerApi();
            await openUrl(url);
            return;
        } catch {
            // Browser fallback below also works for development web builds.
        }
    }

    globalThis.open?.(url, '_blank', 'noopener');
}

export async function openProjectInNewEditorWindow(manifestPath: string): Promise<void> {
    const url = buildEditorStartupUrl(manifestPath);

    if (!isTauriRuntime()) {
        const opened = globalThis.open?.(url, '_blank', 'noopener');
        if (!opened) {
            throw new Error('The browser blocked the new editor window.');
        }
        return;
    }

    const { WebviewWindow } = await getTauriWebviewWindowApi();
    const editorWindow = new WebviewWindow(createEditorWindowLabel(), {
        dragDropEnabled: false,
        focus: true,
        height: 720,
        minHeight: 540,
        minWidth: 960,
        title: 'Zerith Editor',
        url,
        width: 1280,
    });

    await new Promise<void>((resolve, reject) => {
        let settled = false;
        const settle = (callback: () => void) => {
            if (settled) return;
            settled = true;
            callback();
        };

        void editorWindow.once('tauri://created', () => {
            settle(resolve);
        }).catch((error: unknown) => {
            settle(() => reject(toError(error)));
        });

        void editorWindow.once<unknown>('tauri://error', (event) => {
            settle(() => reject(new Error(formatWebviewWindowError(event.payload))));
        }).catch((error: unknown) => {
            settle(() => reject(toError(error)));
        });
    });
}

function createEditorWindowLabel(): string {
    return `editor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatWebviewWindowError(payload: unknown): string {
    if (payload instanceof Error) return payload.message;
    if (typeof payload === 'string') return payload;
    return JSON.stringify(payload) ?? String(payload);
}

async function getOpenerApi(): Promise<typeof import('@tauri-apps/plugin-opener')> {
    openerApiPromise ??= import('@tauri-apps/plugin-opener');
    return openerApiPromise;
}

async function getTauriWebviewWindowApi(): Promise<typeof import('@tauri-apps/api/webviewWindow')> {
    tauriWebviewWindowApiPromise ??= import('@tauri-apps/api/webviewWindow');
    return tauriWebviewWindowApiPromise;
}

async function getTauriWindowApi(): Promise<typeof import('@tauri-apps/api/window')> {
    tauriWindowApiPromise ??= import('@tauri-apps/api/window');
    return tauriWindowApiPromise;
}

function toError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
}

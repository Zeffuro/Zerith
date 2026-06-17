import { isTauriRuntime } from './runtimeEnvironment';

export type EditorCloseRequestedEvent = {
    preventDefault: () => void;
};

let openerApiPromise: Promise<typeof import('@tauri-apps/plugin-opener')> | undefined;
let tauriWindowApiPromise: Promise<typeof import('@tauri-apps/api/window')> | undefined;

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

async function getOpenerApi(): Promise<typeof import('@tauri-apps/plugin-opener')> {
    openerApiPromise ??= import('@tauri-apps/plugin-opener');
    return openerApiPromise;
}

async function getTauriWindowApi(): Promise<typeof import('@tauri-apps/api/window')> {
    tauriWindowApiPromise ??= import('@tauri-apps/api/window');
    return tauriWindowApiPromise;
}

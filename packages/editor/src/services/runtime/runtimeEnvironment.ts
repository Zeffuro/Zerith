export function isTauriRuntime(): boolean {
    const runtime = globalThis as {
        __TAURI__?: unknown;
        __TAURI_INTERNALS__?: unknown;
    } & typeof globalThis;

    return runtime.__TAURI__ !== undefined || runtime.__TAURI_INTERNALS__ !== undefined;
}

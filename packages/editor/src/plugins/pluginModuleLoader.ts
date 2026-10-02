export async function loadEditorPluginModule(entryPath: string, bytes: Uint8Array): Promise<unknown> {
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'text/javascript' }));
    try {
        return await import(/* @vite-ignore */ url);
    } catch (error) {
        throw new Error(`Could not load plugin entry '${entryPath}': ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    } finally {
        URL.revokeObjectURL(url);
    }
}

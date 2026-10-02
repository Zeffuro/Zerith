const listeners = new Set<() => void>();
let revision = 0;

export function getPluginRegistryRevision(): number {
    return revision;
}

export function notifyPluginRegistryChanged(): void {
    revision++;
    for (const listener of listeners) listener();
}

export function subscribePluginRegistry(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

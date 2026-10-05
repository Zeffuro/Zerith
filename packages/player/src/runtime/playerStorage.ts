import type { EngineConfig, GameManifest } from '@zeffuro/zerith-core';

export function createPlayerStorage(manifest: GameManifest, configured?: EngineConfig['storage']): EngineConfig['storage'] {
    if (configured) return configured;
    const seed = manifest.id?.trim() || manifest.title?.trim() || 'Game';
    const prefix = `zerith:web:${encodeURIComponent(seed)}:`;
    const memory = new Map<string, string>();
    let storage: Storage | undefined;
    try { storage = globalThis.localStorage; } catch { /* Storage may be unavailable in embedded browsers. */ }
    return {
        getItem: key => storage ? storage.getItem(prefix + key) ?? undefined : memory.get(key),
        removeItem: key => { if (storage) storage.removeItem(prefix + key); else memory.delete(key); },
        setItem: (key, value) => { if (storage) storage.setItem(prefix + key, value); else memory.set(key, value); },
    };
}


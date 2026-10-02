import { describe, expect, it, vi } from 'vitest';

import type { BrowserDirectoryHandle } from '../fs/browserFsAdapter';
import type { BrowserStoredProject } from '../fs/browserProjectHandleStorage';

import { createBrowserProjectRegistry } from '../fs/browserProjectRegistry';
import { MemoryDirectoryHandle, MemoryFileHandle } from './browserFsAdapter.test-utilities';

function fixture(initial: BrowserStoredProject[] = []) {
    let stored = initial;
    const roots = new Map<string, BrowserDirectoryHandle>();
    const storage = {
        load: vi.fn(() => Promise.resolve(stored)),
        replace: vi.fn((next: BrowserStoredProject[]) => { stored = next; return Promise.resolve(); }),
    };
    const registry = createBrowserProjectRegistry(storage, {
        get: path => roots.get(path),
        mount: (handle, path) => { roots.set(path, handle); },
        mounted: () => roots.entries(),
    });
    return { registry, roots, storage };
}

function folder(name = 'Game'): BrowserDirectoryHandle & MemoryDirectoryHandle {
    const handle = new MemoryDirectoryHandle(name);
    handle.files.set('game.json', new MemoryFileHandle('game.json', '{}'));
    return handle;
}

function record(handle: BrowserDirectoryHandle, path = '/Game/game.json'): BrowserStoredProject {
    return { handle, lastOpened: 1, name: handle.name, path };
}

describe('browser project registry', () => {
    it('reuses a nested project when its native directory is picked directly after restart', async () => {
        const parent = new MemoryDirectoryHandle('Projects');
        const child = folder('Created');
        parent.directories.set('Created', child);
        const { registry, roots, storage } = fixture([record(parent, '/Projects/Created/game.json')]);
        const picked = folder('Created');
        picked.isSameEntry = other => Promise.resolve(other === child);
        expect(await registry.mountPicked(picked)).toBe('/Projects/Created');
        expect(roots.get('/Projects')).toBe(parent);
        await registry.remember('/Projects/Created/game.json');
        expect(registry.getSnapshot()).toHaveLength(1);
        expect(storage.replace.mock.calls[0][0][0].handle).toBe(parent);
    });

    it('deduplicates native project directories within queued remembers while retaining the parent path', async () => {
        const parent = new MemoryDirectoryHandle('Projects');
        const child = folder('Created');
        parent.directories.set('Created', child);
        const picked = folder('Created');
        picked.isSameEntry = other => Promise.resolve(other === child);
        const { registry, roots } = fixture();
        roots.set('/Projects', parent);
        roots.set('/Picked', picked);
        await Promise.all([
            registry.remember('/Projects/Created/game.json'),
            registry.remember('/Picked/game.json'),
        ]);
        expect(registry.getSnapshot().map(project => project.path)).toEqual(['/Projects/Created/game.json']);
    });

    it('orders clear after a remember that is waiting for native directory identity', async () => {
        const original = folder();
        const picked = folder();
        let compare!: (same: boolean) => void;
        picked.isSameEntry = vi.fn(() => new Promise<boolean>(resolve => { compare = resolve; }));
        const { registry, roots, storage } = fixture([record(original)]);
        roots.set('/Picked', picked);
        const remembering = registry.remember('/Picked/game.json');
        const clearing = registry.clear();
        await vi.waitFor(() => expect(picked.isSameEntry).toHaveBeenCalled());
        expect(storage.replace).not.toHaveBeenCalled();
        compare(true);
        await Promise.all([remembering, clearing]);
        expect(storage.replace.mock.calls.map(([entries]) => entries.map(project => project.path)))
            .toEqual([['/Game/game.json'], []]);
        expect(registry.getSnapshot()).toEqual([]);
    });

    it('preserves unrelated records when native directory comparisons fail', async () => {
        const original = folder();
        const picked = folder();
        picked.isSameEntry = () => Promise.reject(new DOMException('Access denied', 'NotAllowedError'));
        const { registry, roots } = fixture([record(original)]);
        roots.set('/Picked', picked);
        await registry.remember('/Picked/game.json');
        expect(registry.getSnapshot().map(project => project.path)).toEqual(['/Picked/game.json', '/Game/game.json']);
    });

    it.each([undefined, '', '  ', 12, {}, ['Title']])('falls back to the folder name for title %j', async title => {
        const handle = folder();
        handle.files.set('game.json', new MemoryFileHandle('game.json', JSON.stringify({ title })));
        const { registry, roots } = fixture();
        roots.set('/Game', handle);
        await registry.remember('/Game/game.json');
        expect(registry.getSnapshot()[0]?.name).toBe('Game');
    });

    it('refreshes the meaningful manifest title when a project is reopened', async () => {
        const handle = folder();
        const { registry, roots } = fixture();
        roots.set('/Game', handle);
        handle.files.set('game.json', new MemoryFileHandle('game.json', '{"title":"  First title  "}'));
        await registry.remember('/Game/game.json');
        expect(registry.getSnapshot()[0]?.name).toBe('First title');
        handle.files.set('game.json', new MemoryFileHandle('game.json', '{"title":"Updated title"}'));
        await registry.remember('/Game/game.json');
        expect(registry.getSnapshot().map(project => project.name)).toEqual(['Updated title']);
    });

    it('remembers projects created inside a selected parent and restores that parent mount', async () => {
        const parent = new MemoryDirectoryHandle('Projects');
        parent.directories.set('Created', folder('Created'));
        const first = fixture();
        first.roots.set('/Projects', parent);
        await first.registry.remember('/Projects/Created/game.json');
        expect(first.registry.getSnapshot()[0]?.name).toBe('Created');
        const remembered = first.storage.replace.mock.calls[0][0];
        const restarted = fixture(remembered);
        await restarted.registry.ready();
        await expect(restarted.registry.restore('/Projects/Created/game.json')).resolves.toBe(true);
        expect(restarted.roots.get('/Projects')).toBe(parent);
        expect(await restarted.registry.mountPicked(parent)).toBe('/Projects');
    });

    it('keeps equal folder names distinct and reuses native identity from persisted handles', async () => {
        const original = folder();
        const same = folder();
        same.isSameEntry = other => Promise.resolve(other === original);
        const other = folder();
        const { registry, roots } = fixture([record(original)]);
        expect(await registry.mountPicked(same)).toBe('/Game');
        const newPath = await registry.mountPicked(other);
        expect(newPath).not.toBe('/Game');
        expect(roots.get('/Game')).toBe(same);
        expect(roots.get(newPath)).toBe(other);
        await registry.remember(`${newPath}/game.json`);
        expect(registry.getSnapshot().map(entry => entry.name)).toEqual(['Game', 'Game']);
    });

    it('starts permission requests before yielding and mounts only after granting access', async () => {
        const handle = folder();
        let grant!: (state: PermissionState) => void;
        handle.requestPermission = vi.fn(() => new Promise<PermissionState>(resolve => { grant = resolve; }));
        const { registry, roots } = fixture([record(handle)]);
        await registry.ready();
        const opening = registry.restore('/Game/game.json');
        expect(handle.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
        expect(roots.size).toBe(0);
        grant('granted');
        await expect(opening).resolves.toBe(true);
        expect(roots.get('/Game')).toBe(handle);
    });

    it.each(['denied', 'prompt'] as const)('leaves mounts and records intact when permission is %s', async state => {
        const handle = folder();
        handle.requestPermission = () => Promise.resolve(state);
        const { registry, roots, storage } = fixture([record(handle)]);
        roots.set('/Active', folder('Active'));
        await registry.ready();
        await expect(registry.restore('/Game/game.json')).rejects.toThrow('access was denied');
        expect([...roots.keys()]).toEqual(['/Active']);
        expect(registry.getSnapshot()).toHaveLength(1);
        expect(storage.replace).not.toHaveBeenCalled();
    });

    it('returns cancellation without mounting or dropping a recent project', async () => {
        const handle = folder();
        handle.requestPermission = () => Promise.reject(new DOMException('Cancelled', 'AbortError'));
        const { registry, roots } = fixture([record(handle)]);
        await registry.ready();
        await expect(registry.restore('/Game/game.json')).resolves.toBe(false);
        expect(roots.size).toBe(0);
        expect(registry.getSnapshot()).toHaveLength(1);
    });

    it.each(['missing', 'invalid', 'array', 'listing'])('does not mount an inaccessible %s project', async failure => {
        const handle = folder();
        if (failure === 'missing') handle.files.delete('game.json');
        if (failure === 'invalid') handle.files.set('game.json', new MemoryFileHandle('game.json', '{'));
        if (failure === 'array') handle.files.set('game.json', new MemoryFileHandle('game.json', '[]'));
        if (failure === 'listing') handle.entries = () => { throw new DOMException('Revoked', 'NotAllowedError'); };
        const { registry, roots } = fixture([record(handle)]);
        await registry.ready();
        await expect(registry.restore('/Game/game.json')).rejects.toThrow();
        expect(roots.size).toBe(0);
    });

    it('serializes remember and clear without unmounting the active folder', async () => {
        const { registry, roots, storage } = fixture();
        const handle = folder();
        roots.set('/Game', handle);
        const changed = vi.fn();
        const unsubscribe = registry.subscribe(changed);
        await Promise.all([registry.remember('/Game/game.json'), registry.clear()]);
        expect(storage.replace.mock.calls.map(([entries]) => entries.length)).toEqual([1, 0]);
        expect(registry.getSnapshot()).toEqual([]);
        expect(roots.get('/Game')).toBe(handle);
        expect(handle.files.has('game.json')).toBe(true);
        expect(changed).toHaveBeenCalled();
        unsubscribe();
    });

    it('retains the published list after a failed clear and allows retry', async () => {
        const { registry, storage } = fixture([record(folder())]);
        await registry.ready();
        const snapshot = registry.getSnapshot();
        storage.replace.mockRejectedValueOnce(new Error('Quota exceeded'));
        await expect(registry.clear()).rejects.toThrow('Quota exceeded');
        expect(registry.getSnapshot()).toBe(snapshot);
        await registry.clear();
        expect(registry.getSnapshot()).toEqual([]);
    });

    it('permits picked-folder editing when recent storage is unavailable', async () => {
        const { registry, roots, storage } = fixture();
        storage.load.mockRejectedValue(new Error('Unavailable'));
        const handle = folder();
        const path = await registry.mountPicked(handle);
        expect(roots.get(path)).toBe(handle);
        await expect(registry.remember(`${path}/game.json`)).rejects.toThrow('Unavailable');
    });

    it('keeps the twelve most recently opened folders and deduplicates by stable path', async () => {
        const { registry, roots } = fixture();
        for (let index = 0; index < 14; index++) {
            roots.set(`/Game-${index}`, folder(`Game-${index}`));
            await registry.remember(`/Game-${index}/game.json`);
        }
        await registry.remember('/Game-5/game.json');
        const snapshot = registry.getSnapshot();
        expect(snapshot).toHaveLength(12);
        expect(snapshot[0]?.path).toBe('/Game-5/game.json');
        expect(new Set(snapshot.map(entry => entry.path)).size).toBe(12);
    });
});

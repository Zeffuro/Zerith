import { describe, expect, it, vi } from 'vitest';

import type { BrowserDirectoryHandle } from '../fs/browserFsAdapter';

import { createBrowserFsAdapter } from '../fs/browserFsAdapter';
import { createPickerGlobal, MemoryDirectoryHandle, MemoryFileHandle } from './browserFsAdapter.test-utilities';

const MARKER = '.zerith-project-reservation';

function alias(handle: MemoryDirectoryHandle, name: string): BrowserDirectoryHandle {
    const originalResolve = handle.resolve.bind(handle);
    const result: BrowserDirectoryHandle = {
        entries: handle.entries.bind(handle),
        getDirectoryHandle: handle.getDirectoryHandle.bind(handle),
        getFileHandle: handle.getFileHandle.bind(handle),
        isSameEntry: other => Promise.resolve(other === handle || other === result),
        kind: 'directory',
        name,
        removeEntry: handle.removeEntry.bind(handle),
        resolve: other => originalResolve(other === result ? handle : other),
    };
    vi.spyOn(handle, 'resolve').mockImplementation(other => originalResolve(other === result ? handle : other));
    return result;
}

function fixture() {
    const root = new MemoryDirectoryHandle('Folders');
    const adapter = createBrowserFsAdapter(createPickerGlobal(root));
    return { adapter, path: adapter.mountDirectory(root), root };
}

describe('browser project destination reservation', () => {
    it('reserves a new child and removes only its marker on successful finish', async () => {
        const { adapter, path, root } = fixture();
        await expect(adapter.reserveProjectDestination(`${path}/New`)).resolves.toBe(`${path}/New`);
        const target = root.directories.get('New')!;
        expect([...target.files.keys()]).toEqual([MARKER]);
        await adapter.writeTextFile(`${path}/New/game.json`, 'new project', { createOnly: true });
        await adapter.finishProjectDestination(`${path}/New`);
        expect([...target.files.keys()]).toEqual(['game.json']);
        await expect(adapter.finishProjectDestination(`${path}/New`)).rejects.toThrow('not reserved');
    });

    it('allows an empty selected root and normalizes safe dots and case', async () => {
        const { adapter, path, root } = fixture();
        await root.getDirectoryHandle('Empty', { create: true });
        await expect(adapter.reserveProjectDestination(`${path.toUpperCase()}/Empty/.././empty`)).resolves.toBe(`${path}/Empty`);
        await adapter.finishProjectDestination(`${path}/EMPTY`);
        await expect(adapter.reserveProjectDestination(path)).rejects.toThrow('new or empty');
        const selected = new MemoryDirectoryHandle('Selected');
        const selectedPath = adapter.mountDirectory(selected);
        await expect(adapter.reserveProjectDestination(selectedPath)).resolves.toBe(selectedPath);
    });

    it.each(['file', 'folder', 'case file', 'case folder'])('rejects an occupied %s with zero mutations', async kind => {
        const { adapter, path, root } = fixture();
        const name = kind.startsWith('case') ? 'TARGET' : 'Target';
        if (kind.endsWith('folder')) {
            const target = await root.getDirectoryHandle(name, { create: true });
            target.files.set('keep.txt', new MemoryFileHandle('keep.txt', 'original'));
        } else root.files.set(name, new MemoryFileHandle(name, 'original'));
        const createDirectory = vi.spyOn(root, 'getDirectoryHandle');
        const createFile = vi.spyOn(root, 'getFileHandle');
        await expect(adapter.reserveProjectDestination(`${path}/Target`)).rejects.toThrow(/occupied|new or empty/u);
        expect(createDirectory).not.toHaveBeenCalled();
        expect(createFile).not.toHaveBeenCalled();
    });

    it.each(['/', '', 'Folders/New', '/Folders/../Other', '/Folders/../../Other', String.raw`/Folders/New\Child`, '/Folders/bad:name', '/Folders/New\u0000', '/Folders/New.'])('rejects malformed or escaping path %j', async path => {
        const { adapter, root } = fixture();
        await expect(adapter.reserveProjectDestination(path)).rejects.toThrow();
        expect(root.files.size + root.directories.size).toBe(0);
    });

    it('requires an existing parent and leaves every missing ancestor absent', async () => {
        const { adapter, path, root } = fixture();
        await expect(adapter.reserveProjectDestination(`${path}/Missing/New`)).rejects.toThrow('parent folder');
        expect(root.directories.size).toBe(0);
    });

    it.each(['same', 'descendant', 'ancestor'])('rejects lexical %s source overlap before mutation', async relation => {
        const { adapter, path, root } = fixture();
        const source = await root.getDirectoryHandle('Source', { create: true });
        await source.getDirectoryHandle('Nested', { create: true });
        const targetPath = relation === 'same' ? `${path}/SOURCE/.` : (relation === 'descendant' ? `${path}/Source/New` : path);
        await expect(adapter.reserveProjectDestination(targetPath, `${path}/Source`)).rejects.toThrow('outside the source');
        expect(source.files.size).toBe(0);
        expect(source.directories.has('New')).toBe(false);
    });

    it('rejects source identity across separately mounted directory aliases', async () => {
        const { adapter, path, root } = fixture();
        const other = adapter.mountDirectory(alias(root, 'Alias'));
        await expect(adapter.reserveProjectDestination(other, path)).rejects.toThrow('outside the source');
        expect(root.files.size).toBe(0);
    });

    it.each(['descendant', 'ancestor'])('rejects %s overlap across separately mounted roots', async relation => {
        const { adapter, path, root } = fixture();
        const source = await root.getDirectoryHandle('Source', { create: true });
        const nested = await source.getDirectoryHandle('Nested', { create: true });
        const sourcePath = adapter.mountDirectory(source);
        const nestedPath = adapter.mountDirectory(nested);
        const target = relation === 'descendant' ? `${nestedPath}/New` : path;
        await expect(adapter.reserveProjectDestination(target, sourcePath)).rejects.toThrow('outside the source');
        expect(nested.directories.size).toBe(0);
    });

    it('allows a new sibling under a mounted parent of the source', async () => {
        const { adapter, path, root } = fixture();
        const source = await root.getDirectoryHandle('Source', { create: true });
        source.files.set('game.json', new MemoryFileHandle('game.json', 'source'));
        const sourcePath = adapter.mountDirectory(source);
        await expect(adapter.reserveProjectDestination(`${path}/Copy`, sourcePath)).resolves.toBe(`${path}/Copy`);
    });

    it('fails closed when source identity and ancestry cannot be inspected', async () => {
        const { adapter, path, root } = fixture();
        const source = await root.getDirectoryHandle('Source', { create: true });
        const inaccessible = Object.create(source) as BrowserDirectoryHandle;
        inaccessible.name = 'Unsupported';
        inaccessible.resolve = undefined;
        const sourcePath = adapter.mountDirectory(inaccessible);
        await expect(adapter.reserveProjectDestination(`${path}/Copy`, sourcePath)).rejects.toThrow('Cannot verify');
        expect(root.directories.has('Copy')).toBe(false);
    });

    it.each(['visible parent', 'separate mount', 'intermediate parent'])('rejects a destination inside a project in a %s', async location => {
        const { adapter, path, root } = fixture();
        const nested = await root.getDirectoryHandle('Nested', { create: true });
        const deeper = await nested.getDirectoryHandle('Deeper', { create: true });
        const project = location === 'intermediate parent' ? nested : root;
        project.files.set('GAME.JSON', new MemoryFileHandle('GAME.JSON', 'project'));
        const targetPath = location === 'visible parent' ? `${path}/Nested/Deeper/New` : `${adapter.mountDirectory(deeper)}/New`;
        await expect(adapter.reserveProjectDestination(targetPath)).rejects.toThrow('inside another project');
        expect(deeper.directories.has('New')).toBe(false);
    });

    it('serializes simultaneous reservations and retains the first marker', async () => {
        const { adapter, path, root } = fixture();
        const results = await Promise.allSettled([
            adapter.reserveProjectDestination(`${path}/New`),
            adapter.reserveProjectDestination(`${path}/new`),
        ]);
        expect(results.map(result => result.status)).toEqual(['fulfilled', 'rejected']);
        expect(root.directories.size).toBe(1);
        expect(root.directories.get('New')!.files.has(MARKER)).toBe(true);
    });

    it('propagates permission denial before mutation', async () => {
        const { adapter, path, root } = fixture();
        const denied = new DOMException('Access denied', 'NotAllowedError');
        vi.spyOn(root, 'entries').mockImplementation(() => ({
            [Symbol.asyncIterator]: () => ({ next: () => Promise.reject(denied) }),
        }));
        await expect(adapter.reserveProjectDestination(`${path}/New`)).rejects.toBe(denied);
        expect(root.directories.size).toBe(0);
    });

    it('retains partial output and its reservation after a failed write', async () => {
        const { adapter, path, root } = fixture();
        await adapter.reserveProjectDestination(`${path}/New`);
        const target = root.directories.get('New')!;
        await adapter.writeTextFile(`${path}/New/game.json`, 'first output', { createOnly: true });
        const getFile = target.getFileHandle.bind(target);
        vi.spyOn(target, 'getFileHandle').mockImplementation(async (name, options) => {
            const file = await getFile(name, options);
            if (name === 'asset.bin') file.writeError = new Error('Disk full');
            return file;
        });
        await expect(adapter.writeBinaryFileExclusive!(`${path}/New/asset.bin`, new Uint8Array([1]))).rejects.toThrow('Disk full');
        expect(await adapter.readTextFile(`${path}/New/game.json`)).toBe('first output');
        expect(target.files.has(MARKER)).toBe(true);
        await expect(adapter.reserveProjectDestination(`${path}/New`)).rejects.toThrow('new or empty');
    });

    it('rechecks a newly obtained folder before creating a marker', async () => {
        const { adapter, path, root } = fixture();
        const getDirectory = root.getDirectoryHandle.bind(root);
        vi.spyOn(root, 'getDirectoryHandle').mockImplementation(async (name, options) => {
            const created = await getDirectory(name, options);
            created.files.set('external.txt', new MemoryFileHandle('external.txt', 'keep'));
            return created;
        });
        await expect(adapter.reserveProjectDestination(`${path}/New`)).rejects.toThrow(`Partial output may remain at "${path}/New"`);
        expect([...root.directories.get('New')!.files.keys()]).toEqual(['external.txt']);
    });

    it('reports retained output if another file appears during marker creation', async () => {
        const { adapter, path, root } = fixture();
        const getFile = root.getFileHandle.bind(root);
        vi.spyOn(root, 'getFileHandle').mockImplementation(async (name, options) => {
            const file = await getFile(name, options);
            file.afterClose = () => {
                root.files.set('external.txt', new MemoryFileHandle('external.txt', 'keep'));
                return Promise.resolve();
            };
            return file;
        });
        await expect(adapter.reserveProjectDestination(path)).rejects.toThrow(`Partial output may remain at "${path}"`);
        expect([...root.files.keys()]).toEqual([MARKER, 'external.txt']);
    });

    it('reports retained marker creation failure without deleting partial output', async () => {
        const { adapter, path, root } = fixture();
        const getFile = root.getFileHandle.bind(root);
        vi.spyOn(root, 'getFileHandle').mockImplementation(async (name, options) => {
            const file = await getFile(name, options);
            file.writeError = new Error('Disk full');
            return file;
        });
        await expect(adapter.reserveProjectDestination(path)).rejects.toThrow(`Partial output may remain at "${path}". Disk full`);
        expect(root.files.get(MARKER)!.abortCount).toBe(1);
        await expect(adapter.reserveProjectDestination(path)).rejects.toThrow('new or empty');
    });

    it('retains a changed reservation marker instead of deleting it', async () => {
        const { adapter, path, root } = fixture();
        await adapter.reserveProjectDestination(`${path}/New`);
        root.directories.get('New')!.files.set(MARKER, new MemoryFileHandle(MARKER, 'changed externally'));
        await expect(adapter.finishProjectDestination(`${path}/New`)).rejects.toThrow('reservation changed');
        expect(await adapter.readTextFile(`${path}/New/${MARKER}`)).toBe('changed externally');
    });
});

describe('browser exclusive file writes', () => {
    it.each(['text', 'binary'])('preserves an existing case-insensitive %s target', async kind => {
        const { adapter, path, root } = fixture();
        root.files.set('Existing.bin', new MemoryFileHandle('Existing.bin', 'original'));
        const write = kind === 'text'
            ? adapter.writeTextFile(`${path}/existing.bin`, 'replacement', { createOnly: true })
            : adapter.writeBinaryFileExclusive!(`${path}/existing.bin`, new Uint8Array([1]));
        await expect(write).rejects.toMatchObject({ code: 'alreadyExists' });
        expect(await adapter.readTextFile(`${path}/Existing.bin`)).toBe('original');
        expect(root.files.size).toBe(1);
    });

    it('serializes simultaneous text and binary creation of the same file', async () => {
        const { adapter, path, root } = fixture();
        const results = await Promise.allSettled([
            adapter.writeTextFile(`${path}/New.bin`, 'first', { createOnly: true }),
            adapter.writeBinaryFileExclusive!(`${path}/new.bin`, new Uint8Array([1])),
        ]);
        expect(results.map(result => result.status)).toEqual(['fulfilled', 'rejected']);
        expect(await adapter.readTextFile(`${path}/New.bin`)).toBe('first');
        expect(root.files.size).toBe(1);
    });

    it('rejects a directory collision without creating a file', async () => {
        const { adapter, path, root } = fixture();
        await root.getDirectoryHandle('Existing', { create: true });
        await expect(adapter.writeBinaryFileExclusive!(`${path}/existing`, new Uint8Array([1]))).rejects.toMatchObject({ code: 'alreadyExists' });
        expect(root.files.size).toBe(0);
    });
});

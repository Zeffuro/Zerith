import { describe, expect, it, vi } from 'vitest';

import { createBrowserFsAdapter } from '../fs/browserFsAdapter';
import { createPickerGlobal, MemoryDirectoryHandle, MemoryFileHandle } from './browserFsAdapter.test-utilities';

function fixture() {
    const root = new MemoryDirectoryHandle('Project');
    const adapter = createBrowserFsAdapter(createPickerGlobal(root));
    adapter.mountDirectory(root);
    return { adapter, root };
}

async function snapshot(directory: MemoryDirectoryHandle): Promise<Record<string, number[]>> {
    const result: Record<string, number[]> = {};
    for (const [name, child] of directory.directories) {
        for (const [path, bytes] of Object.entries(await snapshot(child))) result[`${name}/${path}`] = bytes;
    }
    for (const [name, file] of directory.files) {
        const contents = await file.getFile();
        result[name] = [...new Uint8Array(await contents.arrayBuffer())];
    }
    return result;
}

function sourceFolder(root: MemoryDirectoryHandle) {
    const source = new MemoryDirectoryHandle('source');
    const nested = new MemoryDirectoryHandle('nested');
    source.files.set('first.txt', new MemoryFileHandle('first.txt', 'first'));
    nested.files.set('last.bin', new MemoryFileHandle('last.bin', new Uint8Array([0, 128, 255])));
    source.directories.set('nested', nested);
    root.directories.set('source', source);
    return { nested, source };
}

describe('browserFsAdapter moves', () => {
    it.each(['file', 'folder'] as const)('treats normalized identical %s paths as a no-op', async (kind) => {
        const { adapter, root } = fixture();
        if (kind === 'file') root.files.set('source', new MemoryFileHandle('source', 'original'));
        else sourceFolder(root);
        const before = await snapshot(root);
        const remove = vi.spyOn(root, 'removeEntry');

        await adapter.rename('/Project/source', '/Project//source');

        expect(await snapshot(root)).toEqual(before);
        expect(remove).not.toHaveBeenCalled();
    });

    it.each([
        ['file', 'file'],
        ['file', 'folder'],
        ['folder', 'file'],
        ['folder', 'folder'],
    ] as const)('preserves both entries for a %s move onto an existing %s', async (sourceKind, destinationKind) => {
        const { adapter, root } = fixture();
        if (sourceKind === 'file') root.files.set('source', new MemoryFileHandle('source', 'original'));
        else sourceFolder(root);
        if (destinationKind === 'file') root.files.set('target', new MemoryFileHandle('target', 'existing'));
        else {
            const target = new MemoryDirectoryHandle('target');
            target.files.set('keep.txt', new MemoryFileHandle('keep.txt', 'existing'));
            root.directories.set('target', target);
        }
        const before = await snapshot(root);

        await expect(adapter.rename('/Project/source', '/Project/target')).rejects.toThrow();

        expect(await snapshot(root)).toEqual(before);
    });

    it('rejects case-insensitive destination collisions without changing either file', async () => {
        const { adapter, root } = fixture();
        root.files.set('source.txt', new MemoryFileHandle('source.txt', 'source'));
        root.files.set('Target.txt', new MemoryFileHandle('Target.txt', 'existing'));
        const before = await snapshot(root);

        await expect(adapter.rename('/Project/source.txt', '/Project/target.txt')).rejects.toThrow();

        expect(await snapshot(root)).toEqual(before);
    });

    it('rejects case-only renaming without deleting the source file', async () => {
        const { adapter, root } = fixture();
        root.files.set('Source.txt', new MemoryFileHandle('Source.txt', 'source'));
        const before = await snapshot(root);

        await expect(adapter.rename('/Project/Source.txt', '/Project/source.txt')).rejects.toThrow();

        expect(await snapshot(root)).toEqual(before);
    });

    it('rejects moving a folder into itself before creating a destination', async () => {
        const { adapter, root } = fixture();
        const { source } = sourceFolder(root);
        const originalEntries = source.entries.bind(source);
        const originalGetDirectory = source.getDirectoryHandle.bind(source);
        vi.spyOn(source, 'getDirectoryHandle').mockImplementation(async (name, options) => {
            const directory = await originalGetDirectory(name, options);
            if (name === 'moved') {
                vi.spyOn(directory, 'getDirectoryHandle').mockRejectedValue(new Error('Recursive traversal'));
            }
            return directory;
        });
        let traversals = 0;
        vi.spyOn(source, 'entries').mockImplementation(() => {
            traversals += 1;
            if (traversals > 2) throw new Error('Recursive traversal');
            return originalEntries();
        });

        await expect(adapter.rename('/Project/source', '/Project/source/moved')).rejects.toThrow();

        expect(root.directories.get('source')).toBe(source);
        expect(source.directories.has('moved')).toBe(false);
        expect(traversals).toBe(0);
    });

    it('rejects descendant destinations reached through another mounted root', async () => {
        const { adapter, root } = fixture();
        const { nested, source } = sourceFolder(root);
        const alias = adapter.mountDirectory(nested);
        const create = vi.spyOn(nested, 'getDirectoryHandle');
        const entries = vi.spyOn(source, 'entries').mockImplementation(() => {
            throw new Error('Unexpected source traversal');
        });

        await expect(adapter.rename('/Project/source', `${alias}/moved`)).rejects.toThrow();

        expect(create).not.toHaveBeenCalled();
        expect(entries).not.toHaveBeenCalled();
        expect(nested.directories.size).toBe(0);
    });

    it('transfers nested text and binary bytes before removing the source folder', async () => {
        const { adapter, root } = fixture();
        const { source } = sourceFolder(root);
        const before = await snapshot(source);
        const remove = vi.spyOn(root, 'removeEntry');

        await adapter.rename('/Project/source', '/Project/target');

        expect(root.directories.has('source')).toBe(false);
        expect(await snapshot(root.directories.get('target')!)).toEqual(before);
        expect(remove).toHaveBeenCalledExactlyOnceWith('source', { recursive: true });
    });

    it.each(['read', 'write', 'close'] as const)('preserves the entire source and reports partial output after %s failure', async (stage) => {
        const { adapter, root } = fixture();
        const { source } = sourceFolder(root);
        const before = await snapshot(source);
        const failing = source.files.get('first.txt')!;
        const failure = new DOMException(`${stage} denied`, 'NotAllowedError');
        const remove = vi.spyOn(root, 'removeEntry');
        if (stage === 'read') vi.spyOn(failing, 'getFile').mockRejectedValueOnce(failure);
        else {
            const originalGetDirectory = root.getDirectoryHandle.bind(root);
            vi.spyOn(root, 'getDirectoryHandle').mockImplementation(async (name, options) => {
                const directory = await originalGetDirectory(name, options);
                if (name === 'target') {
                    const originalGetFile = directory.getFileHandle.bind(directory);
                    vi.spyOn(directory, 'getFileHandle').mockImplementation(async (fileName, fileOptions) => {
                        const file = await originalGetFile(fileName, fileOptions);
                        if (fileName === 'first.txt') {
                            if (stage === 'write') file.writeError = failure;
                            else file.closeError = failure;
                        }
                        return file;
                    });
                }
                return directory;
            });
        }

        const error = await adapter.rename('/Project/source', '/Project/target').catch((error_: unknown) => error_);

        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('/Project/target');
        expect((error as Error).message).toMatch(/source.*remains/iu);
        expect(await snapshot(source)).toEqual(before);
        expect(root.directories.get('source')).toBe(source);
        expect(root.directories.has('target')).toBe(true);
        expect(remove).not.toHaveBeenCalled();
        if (stage !== 'read') expect(root.directories.get('target')!.files.get('first.txt')!.abortCount).toBe(1);
    });

    it('reports both copies retained when source removal fails', async () => {
        const { adapter, root } = fixture();
        const { source } = sourceFolder(root);
        const before = await snapshot(source);
        vi.spyOn(root, 'removeEntry').mockRejectedValue(new DOMException('Removal denied', 'NotAllowedError'));

        const error = await adapter.rename('/Project/source', '/Project/target').catch((error_: unknown) => error_);

        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('/Project/target');
        expect((error as Error).message).toMatch(/destination.*remains/iu);
        expect(await snapshot(source)).toEqual(before);
        expect(await snapshot(root.directories.get('target')!)).toEqual(before);
        expect(root.directories.get('source')).toBe(source);
    });

    it('preserves a denied source lookup error without falling back to a directory', async () => {
        const { adapter, root } = fixture();
        root.files.set('source.txt', new MemoryFileHandle('source.txt', 'source'));
        const failure = new DOMException('Source access denied', 'NotAllowedError');
        vi.spyOn(root, 'getFileHandle').mockRejectedValueOnce(failure);
        const directory = vi.spyOn(root, 'getDirectoryHandle');

        await expect(adapter.rename('/Project/source.txt', '/Project/target.txt')).rejects.toBe(failure);

        expect(directory).not.toHaveBeenCalled();
        expect(root.files.has('source.txt')).toBe(true);
        expect(root.files.has('target.txt')).toBe(false);
    });

    it.each(['same-size edit', 'new file'] as const)('retains a source folder changed during copying: %s', async (change) => {
        const { adapter, root } = fixture();
        const { source } = sourceFolder(root);
        const originalGetDirectory = root.getDirectoryHandle.bind(root);
        vi.spyOn(root, 'getDirectoryHandle').mockImplementation(async (name, options) => {
            const directory = await originalGetDirectory(name, options);
            if (name === 'target') {
                const originalGetFile = directory.getFileHandle.bind(directory);
                vi.spyOn(directory, 'getFileHandle').mockImplementation(async (fileName, fileOptions) => {
                    const file = await originalGetFile(fileName, fileOptions);
                    file.afterClose = async () => {
                        if (fileName !== 'first.txt') return;
                        if (change === 'same-size edit') {
                            const writer = await source.files.get('first.txt')!.createWritable();
                            await writer.write('later');
                            await writer.close();
                        } else source.directories.get('nested')!.files.set('added.txt', new MemoryFileHandle('added.txt', 'new'));
                    };
                    return file;
                });
            }
            return directory;
        });
        const remove = vi.spyOn(root, 'removeEntry');

        const error = await adapter.rename('/Project/source', '/Project/target').catch((error_: unknown) => error_);

        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('/Project/target');
        expect((error as Error).message).toMatch(/source.*remains/iu);
        expect(root.directories.get('source')).toBe(source);
        expect(root.directories.has('target')).toBe(true);
        expect(remove).not.toHaveBeenCalled();
        if (change === 'same-size edit') {
            await expect(adapter.readTextFile('/Project/source/first.txt')).resolves.toBe('later');
        } else expect(source.directories.get('nested')!.files.has('added.txt')).toBe(true);
    });

    it.each(['removed child', 'file became directory', 'directory became file'] as const)(
        'preserves changed source entries after copying: %s',
        async (change) => {
            const { adapter, root } = fixture();
            const { nested, source } = sourceFolder(root);
            const before = await snapshot(source);
            vi.spyOn(source, 'entries').mockImplementation(async function* () {
                const entries = [...source.directories, ...source.files];
                await Promise.resolve();
                yield* entries;
            });
            const originalGetDirectory = root.getDirectoryHandle.bind(root);
            let changedSource: Record<string, number[]> | undefined;
            vi.spyOn(root, 'getDirectoryHandle').mockImplementation(async (name, options) => {
                const directory = await originalGetDirectory(name, options);
                if (name === 'target') {
                    const originalGetFile = directory.getFileHandle.bind(directory);
                    vi.spyOn(directory, 'getFileHandle').mockImplementation(async (fileName, fileOptions) => {
                        const file = await originalGetFile(fileName, fileOptions);
                        if (fileName === 'first.txt') {
                            file.afterClose = async () => {
                                if (change === 'removed child') nested.files.delete('last.bin');
                                else if (change === 'file became directory') {
                                    nested.files.delete('last.bin');
                                    const replacement = new MemoryDirectoryHandle('last.bin');
                                    replacement.files.set('uncopied.txt', new MemoryFileHandle('uncopied.txt', 'new content'));
                                    nested.directories.set('last.bin', replacement);
                                } else {
                                    source.directories.delete('nested');
                                    source.files.set('nested', new MemoryFileHandle('nested', 'replacement content'));
                                }
                                changedSource = await snapshot(source);
                            };
                        }
                        return file;
                    });
                }
                return directory;
            });
            const remove = vi.spyOn(root, 'removeEntry');

            const error = await adapter.rename('/Project/source', '/Project/target').catch((error_: unknown) => error_);

            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toContain('/Project/target');
            expect((error as Error).message).toMatch(/source.*remains/iu);
            expect(changedSource).toBeDefined();
            expect(await snapshot(source)).toEqual(changedSource);
            expect(root.directories.get('source')).toBe(source);
            expect(await snapshot(root.directories.get('target')!)).toEqual(before);
            expect(remove).not.toHaveBeenCalled();
        },
    );
});

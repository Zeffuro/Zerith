import { describe, expect, it } from 'vitest';

import type {
    BrowserDirectoryHandle,
    BrowserEntryHandle,
    BrowserFileHandle,
    BrowserFsGlobal,
    BrowserWritableFileStream,
} from '../fs/browserFsAdapter';

import { createBrowserFsAdapter } from '../fs/browserFsAdapter';

describe('browserFsAdapter', () => {
    it('mounts a picked project directory and reads game.json through a virtual path', async () => {
        const root = new MemoryDirectoryHandle('Example Game');
        root.files.set('game.json', new MemoryFileHandle('game.json', '{"title":"Example"}'));
        const adapter = createBrowserFsAdapter(createPickerGlobal(root));

        const result = await adapter.pickProjectManifest();

        expect(result).toEqual({
            manifestPath: '/Example-Game/game.json',
            projectPath: '/Example-Game',
        });
        await expect(adapter.readTextFile('/Example-Game/game.json')).resolves.toBe('{"title":"Example"}');
    });

    it('creates directories, writes files, and renames files inside a mounted directory', async () => {
        const root = new MemoryDirectoryHandle('Case');
        root.files.set('game.json', new MemoryFileHandle('game.json', '{}'));
        const adapter = createBrowserFsAdapter(createPickerGlobal(root));

        await adapter.pickProjectManifest();
        await adapter.mkdir('/Case/scenes');
        await adapter.writeTextFile('/Case/scenes/intro.json', '[]');
        await adapter.rename('/Case/scenes/intro.json', '/Case/scenes/opening.json');

        const entries = await adapter.readDirectory('/Case/scenes');
        expect(entries).toEqual([
            { isDirectory: false, isFile: true, isSymlink: false, name: 'opening.json' },
        ]);
        await expect(adapter.readTextFile('/Case/scenes/opening.json')).resolves.toBe('[]');
    });

    it('writes and reads binary files', async () => {
        const root = new MemoryDirectoryHandle('Binary');
        root.files.set('game.json', new MemoryFileHandle('game.json', '{}'));
        const adapter = createBrowserFsAdapter(createPickerGlobal(root));

        await adapter.pickProjectManifest();
        await adapter.writeBinaryFile('/Binary/logo.bin', new Uint8Array([1, 2, 3]));

        await expect(adapter.readBinaryFile('/Binary/logo.bin')).resolves.toEqual(new Uint8Array([1, 2, 3]));
    });
});

class MemoryFileHandle implements BrowserFileHandle {
    public readonly kind = 'file' as const;
    private bytes: Uint8Array;

    constructor(
        public readonly name: string,
        content: string | Uint8Array,
    ) {
        this.bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;
    }

    public createWritable(): Promise<BrowserWritableFileStream> {
        return Promise.resolve({
            close: () => Promise.resolve(),
            write: async (data) => {
                if (typeof data === 'string') {
                    this.bytes = new TextEncoder().encode(data);
                    return;
                }

                if (data instanceof Blob) {
                    this.bytes = new Uint8Array(await data.arrayBuffer());
                    return;
                }

                if (data instanceof ArrayBuffer) {
                    this.bytes = new Uint8Array(data);
                    return;
                }

                this.bytes = new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
            },
        });
    }

    public getFile(): Promise<File> {
        const bytes = new Uint8Array(this.bytes);
        return Promise.resolve(new File([bytes.buffer], this.name));
    }
}

class MemoryDirectoryHandle implements BrowserDirectoryHandle {
    public readonly directories = new Map<string, MemoryDirectoryHandle>();
    public readonly files = new Map<string, MemoryFileHandle>();
    public readonly kind = 'directory' as const;

    constructor(public readonly name: string) {}

    public async *entries(): AsyncIterable<[string, BrowserEntryHandle]> {
        await Promise.resolve();
        for (const entry of this.directories) {
            yield entry;
        }
        for (const entry of this.files) {
            yield entry;
        }
    }

    public getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<MemoryDirectoryHandle> {
        const existing = this.directories.get(name);
        if (existing) return Promise.resolve(existing);
        if (!options?.create) return Promise.reject(new Error(`Missing directory: ${name}`));

        const created = new MemoryDirectoryHandle(name);
        this.directories.set(name, created);
        return Promise.resolve(created);
    }

    public getFileHandle(name: string, options?: { create?: boolean }): Promise<MemoryFileHandle> {
        const existing = this.files.get(name);
        if (existing) return Promise.resolve(existing);
        if (!options?.create) return Promise.reject(new Error(`Missing file: ${name}`));

        const created = new MemoryFileHandle(name, '');
        this.files.set(name, created);
        return Promise.resolve(created);
    }

    public removeEntry(name: string): Promise<void> {
        this.files.delete(name);
        this.directories.delete(name);
        return Promise.resolve();
    }
}

function createPickerGlobal(root: MemoryDirectoryHandle): BrowserFsGlobal {
    return {
        ...globalThis,
        showDirectoryPicker: () => Promise.resolve(root),
    };
}

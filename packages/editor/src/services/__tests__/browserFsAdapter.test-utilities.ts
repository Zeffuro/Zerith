import type {
    BrowserDirectoryHandle,
    BrowserEntryHandle,
    BrowserFileHandle,
    BrowserFsGlobal,
    BrowserWritableFileStream,
} from '../fs/browserFsAdapter';

export class MemoryDirectoryHandle implements BrowserDirectoryHandle {
    public readonly directories = new Map<string, MemoryDirectoryHandle>();
    public readonly files = new Map<string, MemoryFileHandle>();
    public readonly kind = 'directory' as const;

    constructor(public readonly name: string) {}

    public async *entries(): AsyncIterable<[string, BrowserEntryHandle]> {
        await Promise.resolve();
        yield* this.directories;
        yield* this.files;
    }

    public getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<MemoryDirectoryHandle> {
        const existing = this.directories.get(name);
        if (existing) return Promise.resolve(existing);
        if (this.files.has(name)) return Promise.reject(new DOMException('Entry is a file.', 'TypeMismatchError'));
        if (!options?.create) return Promise.reject(new DOMException('Directory is missing.', 'NotFoundError'));
        const created = new MemoryDirectoryHandle(name);
        this.directories.set(name, created);
        return Promise.resolve(created);
    }

    public getFileHandle(name: string, options?: { create?: boolean }): Promise<MemoryFileHandle> {
        const existing = this.files.get(name);
        if (existing) return Promise.resolve(existing);
        if (this.directories.has(name)) return Promise.reject(new DOMException('Entry is a directory.', 'TypeMismatchError'));
        if (!options?.create) return Promise.reject(new DOMException('File is missing.', 'NotFoundError'));
        const created = new MemoryFileHandle(name, '');
        this.files.set(name, created);
        return Promise.resolve(created);
    }

    public removeEntry(name: string): Promise<void> {
        if (!this.files.has(name) && !this.directories.has(name)) {
            return Promise.reject(new DOMException('Entry is missing.', 'NotFoundError'));
        }
        this.files.delete(name);
        this.directories.delete(name);
        return Promise.resolve();
    }

    public async resolve(handle: BrowserEntryHandle): Promise<null | string[]> {
        if (handle === this) return [];
        for (const [name, file] of this.files) {
            if (file === handle) return [name];
        }
        for (const [name, directory] of this.directories) {
            const relative = await directory.resolve(handle);
            if (relative) return [name, ...relative];
        }
        // The native handle API returns null for unrelated entries.
        // eslint-disable-next-line unicorn/no-null
        return null;
    }
}

export class MemoryFileHandle implements BrowserFileHandle {
    public abortCount = 0;
    public afterClose?: () => Promise<void>;
    public closeError?: Error;
    public readonly kind = 'file' as const;
    public writeError?: Error;
    private bytes: Uint8Array;
    private lastModified = 1;

    constructor(public readonly name: string, content: string | Uint8Array) {
        this.bytes = typeof content === 'string' ? new TextEncoder().encode(content) : new Uint8Array(content);
    }

    public createWritable(): Promise<BrowserWritableFileStream> {
        let pending = new Uint8Array(this.bytes);
        return Promise.resolve({
            abort: () => {
                this.abortCount += 1;
                return Promise.resolve();
            },
            close: async () => {
                if (this.closeError) throw this.closeError;
                this.bytes = pending;
                this.lastModified += 1;
                await this.afterClose?.();
            },
            write: async (data) => {
                if (this.writeError) throw this.writeError;
                if (typeof data === 'string') pending = new TextEncoder().encode(data);
                else if (data instanceof Blob) pending = new Uint8Array(await data.arrayBuffer());
                else if (data instanceof ArrayBuffer) pending = new Uint8Array(data);
                else pending = new Uint8Array(data);
            },
        });
    }

    public getFile(): Promise<File> {
        const bytes = new Uint8Array(this.bytes);
        return Promise.resolve(new File([bytes.buffer], this.name, { lastModified: this.lastModified }));
    }
}

export function createPickerGlobal(root: MemoryDirectoryHandle, files: MemoryFileHandle[] = []): BrowserFsGlobal {
    return {
        ...globalThis,
        showDirectoryPicker: () => Promise.resolve(root),
        showOpenFilePicker: () => Promise.resolve(files),
    };
}

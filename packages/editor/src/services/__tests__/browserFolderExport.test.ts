import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BrowserDirectoryHandle } from '../fs/browserFsAdapter';

import { pickBrowserFolderExportTarget, writeBrowserFolderExport } from '../browserFolderExport';
import { MemoryDirectoryHandle, MemoryFileHandle } from './browserFsAdapter.test-utilities';

function fixture() {
    const parent = new MemoryDirectoryHandle('Exports');
    const source = new MemoryDirectoryHandle('Project');
    source.files.set('game.json', new MemoryFileHandle('game.json', 'original project'));
    const target = { folderName: 'Published Game', parent };
    const files = { 'index.html': new TextEncoder().encode('<html>game</html>') };
    return { files, parent, source, target };
}

async function readBytes(file: MemoryFileHandle): Promise<Uint8Array> {
    const snapshot = await file.getFile();
    return new Uint8Array(await snapshot.arrayBuffer());
}

async function readText(file: MemoryFileHandle): Promise<string> {
    const snapshot = await file.getFile();
    return snapshot.text();
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('browser folder export picker', () => {
    it('opens the readwrite picker immediately and trims the folder name', async () => {
        const { parent } = fixture();
        const picker = vi.fn().mockResolvedValue(parent);
        vi.stubGlobal('showDirectoryPicker', picker);

        const pending = pickBrowserFolderExportTarget('  Published Game  ');

        expect(picker).toHaveBeenCalledExactlyOnceWith({ mode: 'readwrite' });
        await expect(pending).resolves.toEqual({ folderName: 'Published Game', parent });
        expect(parent.directories.size).toBe(0);
    });

    it('returns cancellation without creating a destination', async () => {
        vi.stubGlobal('showDirectoryPicker', vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError')));
        await expect(pickBrowserFolderExportTarget('Published')).resolves.toBeUndefined();
    });

    it('propagates permission denial', async () => {
        const denied = new DOMException('Access denied', 'NotAllowedError');
        vi.stubGlobal('showDirectoryPicker', vi.fn().mockRejectedValue(denied));
        await expect(pickBrowserFolderExportTarget('Published')).rejects.toBe(denied);
    });

    it('explains missing browser picker support', async () => {
        vi.stubGlobal('showDirectoryPicker', Reflect.get({}, 'showDirectoryPicker'));
        await expect(pickBrowserFolderExportTarget('Published')).rejects.toThrow('not supported');
    });

    it.each(['', ' '.repeat(3), '.', '..', '../export', 'export/game', String.raw`export\game`, 'game:', 'game?', 'game*', 'game|', 'game"', 'game<', 'game>', 'game.', 'game\u0000', 'game\nname', 'CON', 'lpt1.txt'])('rejects invalid folder name %j before opening the picker', async name => {
        const picker = vi.fn();
        vi.stubGlobal('showDirectoryPicker', picker);
        await expect(pickBrowserFolderExportTarget(name)).rejects.toThrow('Invalid export name');
        expect(picker).not.toHaveBeenCalled();
    });
});

describe('browser folder export writer', () => {
    it('writes exact nested artifact bytes and preserves the project', async () => {
        const { parent, source, target } = fixture();
        const files = {
            'assets/music/theme.ogg': new Uint8Array([0, 255, 18, 128]),
            'assets/sprites/hero.png': new Uint8Array([137, 80, 78, 71]),
            'game.json': new TextEncoder().encode('{"game":true}'),
            'index.html': new TextEncoder().encode('<html>game</html>'),
        };

        await expect(writeBrowserFolderExport(target, files, source)).resolves.toBe('Exports/Published Game');

        const output = parent.directories.get(target.folderName)!;
        for (const [path, expected] of Object.entries(files)) {
            const parts = path.split('/');
            let directory = output;
            for (const name of parts.slice(0, -1)) directory = directory.directories.get(name)!;
            expect(await readBytes(directory.files.get(parts.at(-1)!)!)).toEqual(expected);
        }
        expect(await readText(source.files.get('game.json')!)).toBe('original project');
        expect(source.directories.size).toBe(0);
    });

    it.each(['', '..', 'game/name', String.raw`game\name`, 'game.', 'NUL'])('rejects invalid direct-call folder name %j without mutation', async folderName => {
        const { files, parent, source, target } = fixture();
        await expect(writeBrowserFolderExport({ ...target, folderName }, files, source)).rejects.toThrow('Invalid export name');
        expect(parent.directories.size).toBe(0);
    });

    it.each(['source', 'descendant'])('rejects a %s destination before reservation', async location => {
        const { files, source, target } = fixture();
        const parent = location === 'source' ? source : await source.getDirectoryHandle('nested', { create: true });
        const create = vi.spyOn(parent, 'getDirectoryHandle');

        await expect(writeBrowserFolderExport({ ...target, parent }, files, source)).rejects.toThrow('outside the source project');

        expect(create).not.toHaveBeenCalled();
        expect(source.files.size).toBe(1);
        expect(parent.directories.has(target.folderName)).toBe(false);
    });

    it('requires ancestry validation and propagates ancestry errors without reservation', async () => {
        const { files, parent, source, target } = fixture();
        const unsupported = Object.create(source) as BrowserDirectoryHandle;
        unsupported.resolve = undefined;
        await expect(writeBrowserFolderExport(target, files, unsupported)).rejects.toThrow('Cannot verify');
        const denied = new DOMException('Ancestry denied', 'NotAllowedError');
        vi.spyOn(source, 'resolve').mockRejectedValue(denied);
        await expect(writeBrowserFolderExport(target, files, source)).rejects.toBe(denied);
        expect(parent.directories.size).toBe(0);
    });

    it.each(['folder', 'file', 'case folder', 'case file'])('preserves an existing %s destination', async kind => {
        const { files, parent, source, target } = fixture();
        const name = kind.startsWith('case') ? target.folderName.toUpperCase() : target.folderName;
        const existing = new MemoryFileHandle('original.txt', 'keep these bytes');
        if (kind.endsWith('folder')) {
            const directory = await parent.getDirectoryHandle(name, { create: true });
            directory.files.set(existing.name, existing);
        } else {
            parent.files.set(name, existing);
        }
        const create = vi.spyOn(parent, 'getDirectoryHandle');

        await expect(writeBrowserFolderExport(target, files, source)).rejects.toThrow('already exists');

        expect(create).not.toHaveBeenCalled();
        expect(await readText(existing)).toBe('keep these bytes');
    });

    it.each(['', '/index.html', '../game.json', 'assets/../game.json', 'assets//hero.png', String.raw`assets\hero.png`, 'assets/ hero.png', 'assets/hero.png ', 'assets/hero.', 'assets/CON.txt', 'assets/hero\u0000.png'])('rejects invalid artifact path %j before reservation', async path => {
        const { parent, source, target } = fixture();
        await expect(writeBrowserFolderExport(target, { [path]: new Uint8Array([42]) }, source)).rejects.toThrow('Invalid export name');
        expect(parent.directories.size).toBe(0);
    });

    it.each([
        ['index.html', 'INDEX.HTML'],
        ['assets/hero.png', 'Assets/music.ogg'],
        ['assets/hero.png', 'assets'],
        ['assets', 'assets/hero.png'],
    ])('rejects conflicting artifact paths %j and %j before reservation', async (first, second) => {
        const { parent, source, target } = fixture();
        const files = { [first]: new Uint8Array([1]), [second]: new Uint8Array([2]) };
        await expect(writeBrowserFolderExport(target, files, source)).rejects.toThrow('paths collide');
        expect(parent.directories.size).toBe(0);
    });

    it('refuses a newly reserved directory populated before inspection and preserves its bytes', async () => {
        const { files, parent, source, target } = fixture();
        const populated = new MemoryDirectoryHandle(target.folderName);
        const existing = new MemoryFileHandle('index.html', 'external bytes');
        populated.files.set(existing.name, existing);
        vi.spyOn(parent, 'getDirectoryHandle').mockImplementation(name => {
            parent.directories.set(name, populated);
            return Promise.resolve(populated);
        });

        await expect(writeBrowserFolderExport(target, files, source)).rejects.toThrow('Partial export remains at Exports/Published Game');
        expect(await readText(existing)).toBe('external bytes');
    });

    it('refuses a file observed between artifact writes including a case variant', async () => {
        const { parent, source, target } = fixture();
        const output = new MemoryDirectoryHandle(target.folderName);
        const first = new MemoryFileHandle('first.txt', '');
        const existing = new MemoryFileHandle('SECOND.TXT', 'external bytes');
        first.afterClose = () => {
            output.files.set(existing.name, existing);
            return Promise.resolve();
        };
        const originalGetFile = output.getFileHandle.bind(output);
        vi.spyOn(output, 'getFileHandle').mockImplementation((name, options) => {
            if (name !== first.name) return originalGetFile(name, options);
            output.files.set(name, first);
            return Promise.resolve(first);
        });
        vi.spyOn(parent, 'getDirectoryHandle').mockResolvedValue(output);
        const files = { 'first.txt': new Uint8Array([7]), 'second.txt': new Uint8Array([9]) };

        await expect(writeBrowserFolderExport(target, files, source)).rejects.toThrow('already exists');
        expect(await readText(existing)).toBe('external bytes');
        expect(await readBytes(first)).toEqual(new Uint8Array([7]));
        expect(output.files.has('second.txt')).toBe(false);
    });

    it('refuses an observed directory before adding nested artifacts', async () => {
        const { parent, source, target } = fixture();
        const output = new MemoryDirectoryHandle(target.folderName);
        const interloper = new MemoryDirectoryHandle('ASSETS');
        const existing = new MemoryFileHandle('keep.txt', 'external bytes');
        interloper.files.set(existing.name, existing);
        const originalCreate = output.getFileHandle.bind(output);
        vi.spyOn(output, 'getFileHandle').mockImplementation(async (name, options) => {
            const first = await originalCreate(name, options);
            first.afterClose = () => {
                output.directories.set(interloper.name, interloper);
                return Promise.resolve();
            };
            return first;
        });
        vi.spyOn(parent, 'getDirectoryHandle').mockResolvedValue(output);
        const files = Object.fromEntries<Uint8Array>([
            ['first.txt', new Uint8Array([7])],
            ['assets/hero.png', new Uint8Array([9])],
        ]);

        await expect(writeBrowserFolderExport(target, files, source)).rejects.toThrow('already exists');

        expect(await readText(existing)).toBe('external bytes');
        expect(interloper.files.size).toBe(1);
        expect(output.directories.has('assets')).toBe(false);
    });

    it('refuses a newly created nested directory populated before inspection', async () => {
        const { parent, source, target } = fixture();
        const output = new MemoryDirectoryHandle(target.folderName);
        const nested = new MemoryDirectoryHandle('assets');
        const existing = new MemoryFileHandle('hero.png', 'external bytes');
        nested.files.set(existing.name, existing);
        vi.spyOn(output, 'getDirectoryHandle').mockImplementation(name => {
            output.directories.set(name, nested);
            return Promise.resolve(nested);
        });
        vi.spyOn(parent, 'getDirectoryHandle').mockResolvedValue(output);

        await expect(writeBrowserFolderExport(target, { 'assets/hero.png': new Uint8Array([9]) }, source)).rejects.toThrow('Partial export remains');

        expect(await readText(existing)).toBe('external bytes');
        expect(nested.files.size).toBe(1);
    });

    it.each(['write', 'close'])('aborts a failed %s, retains partial data and refuses retry', async phase => {
        const { files, parent, source, target } = fixture();
        const output = new MemoryDirectoryHandle(target.folderName);
        const file = new MemoryFileHandle('index.html', '');
        const failure = new Error('Disk full');
        if (phase === 'write') file.writeError = failure;
        else file.closeError = failure;
        vi.spyOn(output, 'getFileHandle').mockImplementation(name => {
            output.files.set(name, file);
            return Promise.resolve(file);
        });
        vi.spyOn(parent, 'getDirectoryHandle').mockImplementation(name => {
            parent.directories.set(name, output);
            return Promise.resolve(output);
        });
        const remove = vi.spyOn(parent, 'removeEntry');

        const pending = writeBrowserFolderExport(target, files, source);
        await expect(pending).rejects.toThrow('Disk full. Partial export remains at Exports/Published Game. Choose a new folder name to retry.');
        await expect(pending).rejects.toHaveProperty('cause', failure);
        expect(file.abortCount).toBe(1);
        expect(parent.directories.get(target.folderName)).toBe(output);
        expect(remove).not.toHaveBeenCalled();
        expect(await readText(source.files.get('game.json')!)).toBe('original project');

        await expect(writeBrowserFolderExport(target, files, source)).rejects.toThrow('already exists');
        expect(file.abortCount).toBe(1);
    });
});

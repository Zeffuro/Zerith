import { describe, expect, it } from 'vitest';

import { createBrowserFsAdapter } from '../fs/browserFsAdapter';
import { createPickerGlobal, MemoryDirectoryHandle, MemoryFileHandle } from './browserFsAdapter.test-utilities';

describe('browserFsAdapter', () => {
    it('mounts a picked project directory and reads game.json through a virtual path', async () => {
        const root = new MemoryDirectoryHandle('Example Game');
        root.files.set('game.json', new MemoryFileHandle('game.json', '{"title":"Example"}'));
        const adapter = createBrowserFsAdapter(createPickerGlobal(root));

        const result = await adapter.pickProjectManifest();

        expect(result?.manifestPath).toMatch(/^\/Example-Game-[\da-f-]+\/game.json$/u);
        expect(result?.projectPath).toMatch(/^\/Example-Game-[\da-f-]+$/u);
        await expect(adapter.readTextFile(result!.manifestPath)).resolves.toBe('{"title":"Example"}');
    });

    it('creates directories, writes files, and renames files inside a mounted directory', async () => {
        const root = new MemoryDirectoryHandle('Case');
        root.files.set('game.json', new MemoryFileHandle('game.json', '{}'));
        const adapter = createBrowserFsAdapter(createPickerGlobal(root));

        const picked = await adapter.pickProjectManifest();
        const base = picked!.projectPath;
        await adapter.mkdir(`${base}/scenes`);
        await adapter.writeTextFile(`${base}/scenes/intro.json`, '[]');
        await adapter.rename(`${base}/scenes/intro.json`, `${base}/scenes/opening.json`);

        const entries = await adapter.readDirectory(`${base}/scenes`);
        expect(entries).toEqual([
            { isDirectory: false, isFile: true, isSymlink: false, name: 'opening.json' },
        ]);
        await expect(adapter.readTextFile(`${base}/scenes/opening.json`)).resolves.toBe('[]');
    });

    it('writes and reads binary files', async () => {
        const root = new MemoryDirectoryHandle('Binary');
        root.files.set('game.json', new MemoryFileHandle('game.json', '{}'));
        const adapter = createBrowserFsAdapter(createPickerGlobal(root));

        const picked = await adapter.pickProjectManifest();
        await adapter.writeBinaryFile(`${picked!.projectPath}/logo.bin`, new Uint8Array([1, 2, 3]));

        await expect(adapter.readBinaryFile(`${picked!.projectPath}/logo.bin`)).resolves.toEqual(new Uint8Array([1, 2, 3]));
    });

    it('picks external binary files without mounting their parent directory', async () => {
        const root = new MemoryDirectoryHandle('Binary');
        const pickedFile = new MemoryFileHandle('hero.png', new Uint8Array([4, 5, 6]));
        const adapter = createBrowserFsAdapter(createPickerGlobal(root, [pickedFile]));

        const files = await adapter.pickBinaryFiles({ filters: [{ extensions: ['png'], name: 'Images' }] });

        expect(files).toEqual([
            {
                bytes: new Uint8Array([4, 5, 6]),
                name: 'hero.png',
            },
        ]);
    });
});

import { describe, expect, it, vi } from 'vitest';

import type { CollectExportArtifactManifestDependencies } from '../exportArtifactManifest';

import { collectExportArtifactManifest } from '../exportArtifactManifest';

describe('exportArtifactManifest', () => {
    it('collects normalized file lists and compiled-content hashes from export folders', async () => {
        const dependencies = createDependencies();

        const manifest = await collectExportArtifactManifest('/dist/game', {
            projectFiles: ['game.json'],
        }, dependencies);

        expect(manifest.files).toEqual([
            'assets/index.js',
            'game.json',
            'index.html',
            'zerith.content.json',
        ]);
        expect(manifest.projectFiles).toEqual(['game.json']);
        expect(manifest.fileHashes?.['zerith.content.json']).toMatch(/^[a-f0-9]{64}$/u);
        expect(dependencies.readBinaryFile).toHaveBeenCalledWith('/dist/game/zerith.content.json');
    });
});

function createDependencies(): CollectExportArtifactManifestDependencies {
    const directories = new Map([
        ['/dist/game', [
            { isDirectory: true, isFile: false, isSymlink: false, name: 'assets' },
            { isDirectory: false, isFile: true, isSymlink: false, name: 'index.html' },
            { isDirectory: false, isFile: true, isSymlink: false, name: 'game.json' },
            { isDirectory: false, isFile: true, isSymlink: false, name: 'zerith.content.json' },
            { isDirectory: false, isFile: false, isSymlink: true, name: 'linked.txt' },
        ]],
        ['/dist/game/assets', [
            { isDirectory: false, isFile: true, isSymlink: false, name: 'index.js' },
        ]],
    ]);

    return {
        join: vi.fn((...parts: string[]) => Promise.resolve(parts.join('/').replaceAll(/\/+/gu, '/'))),
        readBinaryFile: vi.fn(() => Promise.resolve(new TextEncoder().encode('{"schemaVersion":2}\n'))),
        readDirectory: vi.fn((path: string) => Promise.resolve(directories.get(path) ?? [])),
    };
}

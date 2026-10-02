/// <reference types="node" />
import { unzipSync } from 'fflate';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { exportGameForBrowser } from '../browserExportGame';
import { exportGame } from '../exportGame';
import { prepareWebGameArtifacts } from '../webGameArtifacts';

const native = vi.hoisted(() => ({ binaryReads: [] as string[], desktop: false, invoke: vi.fn() }));
vi.mock('@zeffuro/zerith-core', async () => import('../../../../core/src/utils/ContentCompiler'));
vi.mock('../runtime/runtimeEnvironment', () => ({ isTauriRuntime: () => native.desktop }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: native.invoke }));
vi.mock('../fs', () => ({
    fsReadBinaryFile: async (path: string) => {
        native.binaryReads.push(path);
        return new Uint8Array(await readFile(path));
    },
    fsReadDirectory: async (path: string) => {
        const entries = await readdir(path, { withFileTypes: true });
        return entries.map((entry) => ({
            isDirectory: entry.isDirectory(),
            isFile: entry.isFile(),
            isSymlink: entry.isSymbolicLink(),
            name: entry.name,
        }));
    },
    fsReadTextFile: (path: string) => readFile(path, 'utf8'),
}));

const fixtures = ['classic-vn-starter', 'example-game'];
const temporaryDirectories: string[] = [];

beforeEach(() => {
    native.binaryReads = [];
    native.invoke.mockImplementation(async (command: string, arguments_: { gamePath: string; paths: string[] }) => {
        if (command === 'hash_export_sources') {
            const result: Record<string, { hash: string; size: number }> = {};
            for (const relative of arguments_.paths) {
                try {
                    const bytes = new Uint8Array(await readFile(path.join(arguments_.gamePath, relative)));
                    result[relative] = { hash: hashBytes(bytes), size: bytes.length };
                } catch { /* Missing optional cache sources are omitted by the native reader. */ }
            }
            return result;
        }
        return { outDirectory: 'C:/ゲーム export', stderr: '', stdout: 'Exported', zipPath: 'C:/ゲーム export.zip' };
    });
});

afterEach(async () => {
    native.desktop = false;
    vi.restoreAllMocks();
    for (const directory of temporaryDirectories.splice(0)) await rm(directory, { force: true, recursive: true });
});

describe('shared installed and browser web exports', () => {
    for (const fixture of fixtures) {
        it(`embeds all runtime chunks and complete ${fixture} content with CLI compiler parity`, async () => {
            const game = fixturePath(fixture);
            const prepared = await prepareWebGameArtifacts(game);
            const source = new URL('../../../../player/scripts/content-compiler.mjs', import.meta.url).href;
            const cli = await import(source) as { compileGameContent: (path: string) => unknown };
            const compiled = JSON.parse(decode(prepared.files['zerith.content.json'])) as { scenes: Record<string, { nextScenes?: string[] }> };
            expect(compiled).toEqual(cli.compileGameContent(game));
            expect(Object.values(compiled.scenes).some((scene) => scene.nextScenes?.length)).toBe(true);
            expect(prepared.projectFiles).toContain('game.json');
            expect(prepared.playerFileCount).toBeGreaterThan(1);
            expect(Object.keys(prepared.files).filter((path) => path.startsWith('zerith-player/'))).toHaveLength(prepared.playerFileCount - 1);
            expect(decode(prepared.files['index.html'])).toContain('./zerith-player/');
            expect(prepared.artifactManifest.fileHashes?.['zerith.content.json']).toMatch(/^[a-f0-9]{64}$/u);
            for (const projectFile of prepared.projectFiles) {
                expect(hashBytes(prepared.files[projectFile])).toBe(hashBytes(new Uint8Array(await readFile(path.join(game, projectFile)))));
            }

            native.desktop = true;
            native.binaryReads = [];
            const desktop = await exportGame(game, { outDir: 'C:/ゲーム export', zip: true });
            const call = native.invoke.mock.calls.at(-1) as [string, { request: { files: { bytes?: number[]; path: string; sourcePath?: string }[] } }];
            expect(call[0]).toBe('export_game');
            const hashes: Record<string, string> = {};
            for (const file of call[1].request.files) {
                if (file.sourcePath) {
                    expect(file.sourcePath.replaceAll('\\', '/')).toBe(`${game.replaceAll('\\', '/')}/${file.path}`);
                    expect(file.bytes).toBeUndefined();
                    hashes[file.path] = hashBytes(new Uint8Array(await readFile(file.sourcePath)));
                } else {
                    hashes[file.path] = hashBytes(new Uint8Array(file.bytes!));
                }
            }
            expect(native.binaryReads).toEqual([]);
            expect(hashes).toEqual(fileHashes(prepared.files));
            expect(desktop.artifactManifest).toEqual(prepared.artifactManifest);
            expect(desktop.outDirectory).toBe('C:/ゲーム export');
        });
    }

    it('downloads a playable browser ZIP with the same assembled files', async () => {
        const game = fixturePath('classic-vn-starter');
        let downloaded: Blob | undefined;
        vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
            downloaded = blob as Blob;
            return 'blob:export-test';
        });
        const link = { click: vi.fn(), download: '', href: '', remove: vi.fn(), style: { display: '' } };
        vi.stubGlobal('document', { body: { append: vi.fn() }, createElement: () => link });
        try {
            const result = await exportGameForBrowser(game, { zip: false, zipFile: '日本語 game.zip' });
            expect(link.click).toHaveBeenCalledOnce();
            expect(link.download).toBe('日本語 game.zip');
            expect(result.stderr).toContain('zip archives');
            const entries = unzipSync(new Uint8Array(await downloaded!.arrayBuffer()));
            const prepared = await prepareWebGameArtifacts(game);
            expect(fileHashes(entries)).toEqual(fileHashes(prepared.files));
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it('honors host base paths and disables the compiled cache', async () => {
        const result = await prepareWebGameArtifacts(fixturePath('classic-vn-starter'), { base: '/games/my-game/', cachePolicy: 'none' });
        expect(decode(result.files['index.html'])).toContain('/games/my-game/zerith-player/');
        expect(JSON.parse(decode(result.files['zerith.content.json']))).not.toHaveProperty('cache');
        await expect(prepareWebGameArtifacts(fixturePath('classic-vn-starter'), { base: 'javascript:alert(1)' })).rejects.toThrow('Export base');
    });

    it('omits private directories from browser, native references, and CLI public files', async () => {
        const directory = await mkdtemp(path.join(tmpdir(), 'zerith-private-export-test-'));
        const out = await mkdtemp(path.join(tmpdir(), 'zerith-public-output-test-'));
        temporaryDirectories.push(directory, out);
        await writeFile(path.join(directory, 'game.json'), '{}');
        for (const folder of ['.dev_docs', 'assets/.dev_docs', '.git', 'node_modules']) {
            await mkdir(path.join(directory, folder), { recursive: true });
            await writeFile(path.join(directory, folder, 'private.txt'), 'do not copy');
        }
        await writeFile(path.join(directory, 'assets', 'public.txt'), 'public');
        const browser = await prepareWebGameArtifacts(directory);
        const desktop = await prepareWebGameArtifacts(directory, {}, { nativeProjectFiles: true });
        expect(browser.projectFiles).toEqual(['assets/public.txt', 'game.json']);
        expect(desktop.projectFiles).toEqual(browser.projectFiles);
        expect(desktop.nativeFiles.map((file) => file.path)).toEqual(browser.projectFiles);
        expect(Object.keys(browser.files).some((file) => file.includes('.dev_docs'))).toBe(false);
        const source = new URL('../../../../player/vite.config.ts', import.meta.url).href;
        const cli = await import(source) as { copyProjectPublicFiles: (game: string, out: string) => void };
        cli.copyProjectPublicFiles(directory, out);
        expect(await readdir(out)).toEqual(['assets', 'game.json']);
        expect(await readdir(path.join(out, 'assets'))).toEqual(['public.txt']);
        await writeFile(path.join(directory, 'game.json'), JSON.stringify({ scenes: { private: '/.dev_docs/private.txt' } }));
        await expect(prepareWebGameArtifacts(directory)).rejects.toThrow('Private project files');
        await expect(prepareWebGameArtifacts(directory, {}, { nativeProjectFiles: true })).rejects.toThrow('Private project files');
    });

    it('rejects runtime collisions and manifest references escaping the project before native writes', async () => {
        const directory = await mkdtemp(path.join(tmpdir(), 'zerith-export-test-'));
        temporaryDirectories.push(directory);
        await writeFile(path.join(directory, 'game.json'), '{}');
        await writeFile(path.join(directory, 'index.html'), 'existing project index');
        await expect(prepareWebGameArtifacts(directory)).rejects.toThrow('conflicts with player');
        await rm(path.join(directory, 'index.html'));
        await writeFile(path.join(directory, 'game.json'), JSON.stringify({ scenes: { escape: '../private.json' } }));
        native.desktop = true;
        native.invoke.mockClear();
        await expect(exportGame(directory)).rejects.toThrow('escapes its directory');
        expect(native.invoke).not.toHaveBeenCalled();
    });
});

function decode(bytes: Uint8Array): string {
    return new TextDecoder().decode(bytes);
}

function fileHashes(files: Record<string, Uint8Array>): Record<string, string> {
    return Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, hashBytes(bytes)]));
}


function fixturePath(name: string): string {
    return fileURLToPath(new URL(`../../../../../games/${name}`, import.meta.url));
}

function hashBytes(bytes: Uint8Array): string {
    return createHash('sha256').update(bytes).digest('hex');
}

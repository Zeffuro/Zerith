#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { zipSync } from 'fflate';
import { build } from 'vite';

function parseArgs(argv) {
    let base;
    let game;
    let outDir;
    let zip = false;
    let zipFile;

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === '--game' && argv[index + 1]) {
            game = argv[index + 1];
            index += 1;
            continue;
        }

        if (arg.startsWith('--game=')) {
            game = arg.slice('--game='.length);
            continue;
        }

        if (arg === '--outDir' && argv[index + 1]) {
            outDir = argv[index + 1];
            index += 1;
            continue;
        }

        if (arg.startsWith('--outDir=')) {
            outDir = arg.slice('--outDir='.length);
            continue;
        }

        if (arg === '--base' && argv[index + 1]) {
            base = argv[index + 1];
            index += 1;
            continue;
        }

        if (arg.startsWith('--base=')) {
            base = arg.slice('--base='.length);
            continue;
        }

        if (arg === '--zip') {
            zip = true;
            continue;
        }

        if (arg === '--zipFile' && argv[index + 1]) {
            zipFile = argv[index + 1];
            index += 1;
            continue;
        }

        if (arg.startsWith('--zipFile=')) {
            zipFile = arg.slice('--zipFile='.length);
        }
    }

    return { base, game, outDir, zip, zipFile };
}

function toAbsolutePath(value, rootPath) {
    if (!value) {
        return undefined;
    }

    return path.isAbsolute(value) ? value : path.resolve(rootPath, value);
}

function assertGamePath(gamePath) {
    const manifestPath = path.join(gamePath, 'game.json');
    if (!fs.existsSync(manifestPath)) {
        throw new Error(`Game path must contain a game.json manifest: ${manifestPath}`);
    }
}

function toZipEntryPath(rootDir, filePath) {
    const relativePath = path.relative(rootDir, filePath);
    return relativePath.split(path.sep).join('/');
}

function collectZipEntries(rootDir, currentDir, entries) {
    const dirEntries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of dirEntries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
            collectZipEntries(rootDir, fullPath, entries);
            continue;
        }

        if (!entry.isFile()) {
            continue;
        }

        entries[toZipEntryPath(rootDir, fullPath)] = fs.readFileSync(fullPath);
    }
}

function createZipArchive(sourceDir, zipPath) {
    const zipEntries = {};
    collectZipEntries(sourceDir, sourceDir, zipEntries);

    const zipBuffer = zipSync(zipEntries, { level: 9 });
    fs.mkdirSync(path.dirname(zipPath), { recursive: true });
    fs.writeFileSync(zipPath, Buffer.from(zipBuffer));

}

async function run() {
    const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const repoRoot = path.resolve(packageRoot, '..', '..');
    const args = parseArgs(process.argv.slice(2));
    const gamePath = toAbsolutePath(args.game ?? 'games/test-game', repoRoot);

    if (!gamePath) {
        throw new Error('Missing --game value. Example: --game=games/test-game');
    }

    assertGamePath(gamePath);

    const gameName = path.basename(gamePath);
    const outputPath = toAbsolutePath(args.outDir, repoRoot)
        ?? path.resolve(repoRoot, 'dist', gameName);
    const base = args.base ?? './';
    const zipPath = toAbsolutePath(args.zipFile, repoRoot)
        ?? `${outputPath}.zip`;

    process.env.ZERITH_GAME_DIR = gamePath;
    process.env.ZERITH_OUT_DIR = outputPath;
    process.env.ZERITH_BASE = base;

    await build({
        configFile: path.resolve(packageRoot, 'vite.config.ts'),
        mode: 'production',
    });

    process.stdout.write(`Built game from ${gamePath} to ${outputPath} (base: ${base})\n`);

    if (args.zip) {
        createZipArchive(outputPath, zipPath);
        process.stdout.write(`Created zip archive at ${zipPath}\n`);
    }
}

run().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
});


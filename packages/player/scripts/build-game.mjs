#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { zipSync } from 'fflate';
import { build } from 'vite';

import { writeCompiledContentManifest } from './content-compiler.mjs';

function parseArgs(argv) {
    let base;
    let cachePolicy;
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

        if (arg === '--cachePolicy' && argv[index + 1]) {
            cachePolicy = argv[index + 1];
            index += 1;
            continue;
        }

        if (arg.startsWith('--cachePolicy=')) {
            cachePolicy = arg.slice('--cachePolicy='.length);
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

    return { base, cachePolicy, game, outDir, zip, zipFile };
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
    const invocationRoot = process.env.INIT_CWD
        ? path.resolve(process.env.INIT_CWD)
        : process.cwd();
    const args = parseArgs(process.argv.slice(2));
    const defaultGameRoot = fs.existsSync(path.join(repoRoot, 'games', 'classic-vn-starter', 'game.json'))
        ? repoRoot
        : invocationRoot;
    const gamePath = resolveGamePath(args.game ?? 'games/classic-vn-starter', {
        fallbackRoot: defaultGameRoot,
        invocationRoot,
        preferInvocationRoot: Boolean(args.game),
        repoRoot,
    });

    if (!gamePath) {
        throw new Error('Missing --game value. Example: --game=games/classic-vn-starter');
    }

    assertGamePath(gamePath);

    const gameName = path.basename(gamePath);
    const outputPath = toAbsolutePath(args.outDir, invocationRoot)
        ?? path.resolve(invocationRoot, 'dist', gameName);
    const base = args.base ?? './';
    const zipPath = toAbsolutePath(args.zipFile, invocationRoot)
        ?? `${outputPath}.zip`;

    process.env.ZERITH_GAME_DIR = gamePath;
    process.env.ZERITH_OUT_DIR = outputPath;
    process.env.ZERITH_BASE = base;

    await build({
        configFile: path.resolve(packageRoot, 'vite.config.ts'),
        mode: 'production',
    });

    const { artifactPath, compiled } = writeCompiledContentManifest(gamePath, outputPath, {
        cachePolicy: args.cachePolicy ?? 'hashed',
    });

    process.stdout.write(`Built game from ${gamePath} to ${outputPath} (base: ${base})\n`);
    process.stdout.write(`Compiled content manifest at ${artifactPath}\n`);
    process.stdout.write(`Compiled content cache: ${compiled.cache ? 'hashed local files' : 'disabled'}\n`);

    if (args.zip) {
        createZipArchive(outputPath, zipPath);
        process.stdout.write(`Created zip archive at ${zipPath}\n`);
    }
}

function resolveGamePath(value, { fallbackRoot, invocationRoot, preferInvocationRoot, repoRoot }) {
    if (!value) {
        return undefined;
    }

    if (path.isAbsolute(value)) {
        return value;
    }

    const roots = preferInvocationRoot
        ? [invocationRoot, repoRoot]
        : [fallbackRoot, invocationRoot, repoRoot];
    for (const rootPath of roots) {
        const candidate = path.resolve(rootPath, value);
        if (fs.existsSync(path.join(candidate, 'game.json'))) {
            return candidate;
        }
    }

    return path.resolve(preferInvocationRoot ? invocationRoot : fallbackRoot, value);
}

run().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
});


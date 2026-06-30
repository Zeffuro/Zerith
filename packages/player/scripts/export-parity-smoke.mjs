#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { build } from 'vite';

import { compileGameContent, writeCompiledContentManifest } from './content-compiler.mjs';

const COMPILED_CONTENT_PATH = 'zerith.content.json';

function parseArgs(argv) {
    let base;
    let cachePolicy;
    let game;
    let outDir;

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
        }
    }

    return { base, cachePolicy, game, outDir };
}

function assertGamePath(gamePath) {
    const manifestPath = path.join(gamePath, 'game.json');
    if (!fs.existsSync(manifestPath)) {
        throw new Error(`Game path must contain a game.json manifest: ${manifestPath}`);
    }
}

function collectFiles(rootDir, currentDir = rootDir) {
    const files = [];
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
        const filePath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
            files.push(...collectFiles(rootDir, filePath));
            continue;
        }

        if (!entry.isFile()) continue;
        files.push(toArtifactPath(path.relative(rootDir, filePath)));
    }

    return uniqueSorted(files);
}

function compareArtifactManifests(browserArtifact, desktopArtifact) {
    const browserFiles = new Set(browserArtifact.files);
    const desktopFiles = new Set(desktopArtifact.files);
    const checks = [
        compareRequiredFile('entryHtml', 'index.html', browserFiles, desktopFiles),
        compareCompiledContent(browserArtifact, desktopArtifact, browserFiles, desktopFiles),
        compareRuntimeAssets(browserFiles, desktopFiles),
        compareProjectFiles(browserArtifact, desktopArtifact, browserFiles, desktopFiles),
    ];

    return {
        checks,
        summary: {
            matched: checks.filter((check) => check.status === 'matched').length,
            mismatched: checks.filter((check) => check.status === 'mismatched').length,
            missing: checks.filter((check) => check.status === 'missing').length,
        },
    };
}

function compareCompiledContent(browserArtifact, desktopArtifact, browserFiles, desktopFiles) {
    const presence = compareRequiredFile('compiledContent', COMPILED_CONTENT_PATH, browserFiles, desktopFiles);
    if (presence.status !== 'matched') return presence;

    const browserHash = browserArtifact.fileHashes[COMPILED_CONTENT_PATH];
    const desktopHash = desktopArtifact.fileHashes[COMPILED_CONTENT_PATH];

    if (browserHash !== desktopHash) {
        return {
            ...presence,
            browser: browserHash ?? 'missing hash',
            desktop: desktopHash ?? 'missing hash',
            note: 'Both exports include zerith.content.json, but their content hashes differ.',
            status: 'mismatched',
        };
    }

    return {
        ...presence,
        browser: browserHash,
        desktop: desktopHash,
        note: 'Both exports include matching compiled-content manifests.',
    };
}

function compareProjectFiles(browserArtifact, desktopArtifact, browserFiles, desktopFiles) {
    const expectedProjectFiles = uniqueSorted([
        ...browserArtifact.projectFiles,
        ...desktopArtifact.projectFiles,
    ]);
    const missingInBrowser = expectedProjectFiles.filter((file) => !browserFiles.has(file));
    const missingInDesktop = expectedProjectFiles.filter((file) => !desktopFiles.has(file));

    return {
        browser: `${expectedProjectFiles.length - missingInBrowser.length}/${expectedProjectFiles.length} project files`,
        desktop: `${expectedProjectFiles.length - missingInDesktop.length}/${expectedProjectFiles.length} project files`,
        id: 'projectFiles',
        missingInBrowser,
        missingInDesktop,
        note: 'Browser zip and desktop Vite export should both carry project publicDir files.',
        status: missingInBrowser.length > 0 || missingInDesktop.length > 0 ? 'missing' : 'matched',
    };
}

function compareRequiredFile(id, filePath, browserFiles, desktopFiles) {
    const normalizedPath = toArtifactPath(filePath);
    const browserHasFile = browserFiles.has(normalizedPath);
    const desktopHasFile = desktopFiles.has(normalizedPath);

    return {
        browser: browserHasFile ? 'present' : 'missing',
        desktop: desktopHasFile ? 'present' : 'missing',
        id,
        missingInBrowser: browserHasFile ? [] : [normalizedPath],
        missingInDesktop: desktopHasFile ? [] : [normalizedPath],
        note: `${normalizedPath} must exist in both browser zip and desktop export artifacts.`,
        status: browserHasFile && desktopHasFile ? 'matched' : 'missing',
    };
}

function compareRuntimeAssets(browserFiles, desktopFiles) {
    const browserRuntimeFiles = [...browserFiles].filter((file) => /^zerith-player\/.+\.js$/u.test(file));
    const desktopRuntimeFiles = [...desktopFiles].filter((file) => /^assets\/.+\.js$/u.test(file));

    return {
        browser: `${browserRuntimeFiles.length} remapped player JS files`,
        desktop: `${desktopRuntimeFiles.length} Vite player JS files`,
        id: 'runtimeAssets',
        missingInBrowser: browserRuntimeFiles.length > 0 ? [] : ['zerith-player/*.js'],
        missingInDesktop: desktopRuntimeFiles.length > 0 ? [] : ['assets/*.js'],
        note: 'Browser zip remaps the prebuilt player runtime while desktop export emits the Vite player runtime.',
        status: browserRuntimeFiles.length > 0 && desktopRuntimeFiles.length > 0 ? 'matched' : 'missing',
    };
}

function createBrowserLikeArtifactManifest(gamePath, playerDistPath, cachePolicy) {
    const playerFiles = collectFiles(playerDistPath)
        .filter((filePath) => filePath === 'index.html' || /^assets\/.+\.js$/u.test(filePath))
        .map((filePath) => (filePath === 'index.html' ? filePath : filePath.replace(/^assets\//u, 'zerith-player/')));
    const projectFiles = collectFiles(gamePath);
    const compiledBytes = Buffer.from(`${JSON.stringify(compileGameContent(gamePath, { cachePolicy }), undefined, 2)}\n`);

    return {
        fileHashes: {
            [COMPILED_CONTENT_PATH]: sha256Hex(compiledBytes),
        },
        files: uniqueSorted([
            ...playerFiles,
            ...projectFiles,
            COMPILED_CONTENT_PATH,
        ]),
        projectFiles,
    };
}

function createDesktopArtifactManifest(outputPath, gamePath) {
    const files = collectFiles(outputPath);
    const compiledPath = path.join(outputPath, COMPILED_CONTENT_PATH);

    return {
        fileHashes: fs.existsSync(compiledPath)
            ? { [COMPILED_CONTENT_PATH]: sha256Hex(fs.readFileSync(compiledPath)) }
            : {},
        files,
        projectFiles: collectFiles(gamePath),
    };
}

function logComparison(comparison) {
    process.stdout.write(`Export parity: matched=${comparison.summary.matched}, mismatched=${comparison.summary.mismatched}, missing=${comparison.summary.missing}\n`);
    for (const check of comparison.checks) {
        process.stdout.write(`${check.id}: ${check.status} browser=${check.browser} desktop=${check.desktop}\n`);
        if (check.missingInBrowser.length > 0) {
            process.stdout.write(`  missing in browser: ${check.missingInBrowser.join(', ')}\n`);
        }
        if (check.missingInDesktop.length > 0) {
            process.stdout.write(`  missing in desktop: ${check.missingInDesktop.join(', ')}\n`);
        }
        if (check.status !== 'matched') {
            process.stdout.write(`  ${check.note}\n`);
        }
    }
}

function sha256Hex(bytes) {
    return createHash('sha256').update(bytes).digest('hex');
}

function toAbsolutePath(value, rootPath) {
    if (!value) return undefined;
    return path.isAbsolute(value) ? value : path.resolve(rootPath, value);
}

function toArtifactPath(filePath) {
    return filePath.split(path.sep).join('/').replaceAll('\\', '/').replaceAll(/^\/+/gu, '');
}

function uniqueSorted(values) {
    return [...new Set(values.map(toArtifactPath).filter((value) => value.length > 0))]
        .sort((left, right) => left.localeCompare(right));
}

async function run() {
    const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const repoRoot = path.resolve(packageRoot, '..', '..');
    const args = parseArgs(process.argv.slice(2));
    const gamePath = toAbsolutePath(args.game ?? 'games/classic-vn-starter', repoRoot);
    const outputPath = toAbsolutePath(args.outDir, repoRoot)
        ?? path.resolve(repoRoot, 'dist', `${path.basename(gamePath)}-parity`);
    const base = args.base ?? './';
    const cachePolicy = args.cachePolicy ?? 'hashed';

    assertGamePath(gamePath);

    process.env.ZERITH_GAME_DIR = gamePath;
    process.env.ZERITH_OUT_DIR = outputPath;
    process.env.ZERITH_BASE = base;

    await build({
        configFile: path.resolve(packageRoot, 'vite.config.ts'),
        mode: 'production',
    });
    writeCompiledContentManifest(gamePath, outputPath, { cachePolicy });

    const browserArtifact = createBrowserLikeArtifactManifest(
        gamePath,
        path.resolve(packageRoot, 'dist'),
        cachePolicy,
    );
    const desktopArtifact = createDesktopArtifactManifest(outputPath, gamePath);
    const comparison = compareArtifactManifests(browserArtifact, desktopArtifact);
    logComparison(comparison);

    if (comparison.summary.mismatched > 0 || comparison.summary.missing > 0) {
        process.exitCode = 1;
    }
}

run().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
});

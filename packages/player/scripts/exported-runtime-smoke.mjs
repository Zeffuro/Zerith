#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const DEFAULT_EXPECTED_TEXTS = [
    'Every classic visual novel starts with a room, a choice, and a promise.',
    'The promise is simple: every line should be easy to find again.',
];

function parseArgs(argv) {
    let base = './';
    const expectedTexts = [];
    let game;
    let outDir;
    let skipBuild = false;

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

        if (arg === '--expect' && argv[index + 1]) {
            expectedTexts.push(argv[index + 1]);
            index += 1;
            continue;
        }

        if (arg.startsWith('--expect=')) {
            expectedTexts.push(arg.slice('--expect='.length));
            continue;
        }

        if (arg === '--skipBuild') {
            skipBuild = true;
        }
    }

    return { base, expectedTexts, game, outDir, skipBuild };
}

function toAbsolutePath(value, rootPath) {
    if (!value) return undefined;
    return path.isAbsolute(value) ? value : path.resolve(rootPath, value);
}

async function runCommand(command, args, options = {}) {
    await new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            stdio: 'inherit',
            ...options,
        });

        child.on('error', reject);
        child.on('exit', (code) => {
            if (code === 0) {
                resolve();
                return;
            }

            reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}.`));
        });
    });
}

async function ensureExportedGame({
    base,
    gamePath,
    outDir,
    packageRoot,
    repoRoot,
    skipBuild,
}) {
    if (skipBuild) {
        if (!fs.existsSync(path.join(outDir, 'index.html'))) {
            throw new Error(`--skipBuild requires an existing exported game at ${outDir}.`);
        }
        return;
    }

    fs.rmSync(outDir, { force: true, recursive: true });
    await runCommand(process.execPath, [
        path.join(packageRoot, 'scripts', 'build-game.mjs'),
        `--game=${gamePath}`,
        `--outDir=${outDir}`,
        `--base=${base}`,
    ], { cwd: packageRoot });
}

function enableRuntimeSmokeAccessibility(outDir) {
    const configPath = path.join(outDir, 'engine.config.json');
    const config = fs.existsSync(configPath)
        ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
        : {};

    config.accessibility = {
        ...config.accessibility,
        captions: true,
        reducedMotion: true,
        selfVoicing: true,
        typewriterSpeedMultiplier: 0,
    };

    fs.writeFileSync(configPath, `${JSON.stringify(config, undefined, 4)}\n`);
}

function snapshotRuntimeConfig(outDir) {
    const configPath = path.join(outDir, 'engine.config.json');
    return {
        configPath,
        existed: fs.existsSync(configPath),
        text: fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : undefined,
    };
}

function restoreRuntimeConfig(snapshot) {
    if (snapshot.existed) {
        fs.writeFileSync(snapshot.configPath, snapshot.text ?? '');
        return;
    }

    fs.rmSync(snapshot.configPath, { force: true });
}

async function createStaticServer(rootDir, base) {
    const serveBasePath = normalizeServeBasePath(base);
    const server = createServer(async (request, response) => {
        try {
            const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
            const pathname = stripServeBasePath(decodeURIComponent(requestUrl.pathname), serveBasePath);
            const requestedPath = path.resolve(rootDir, `.${pathname}`);
            const relativePath = path.relative(rootDir, requestedPath);

            if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
                response.writeHead(403).end('Forbidden');
                return;
            }

            const stat = await fs.promises.stat(requestedPath).catch(() => undefined);
            const filePath = stat?.isDirectory()
                ? path.join(requestedPath, 'index.html')
                : requestedPath;
            const content = await fs.promises.readFile(filePath);

            response.writeHead(200, { 'content-type': contentTypeFor(filePath) });
            response.end(content);
        } catch (error) {
            response.writeHead(404).end(error instanceof Error ? error.message : String(error));
        }
    });

    await new Promise((resolve) => {
        server.listen(0, '127.0.0.1', resolve);
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('Failed to bind static runtime smoke server.');
    }

    return {
        close: () => new Promise((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        }),
        url: `http://127.0.0.1:${address.port}${serveBasePath || '/'}`,
    };
}

function normalizeServeBasePath(base) {
    if (!base || base === './' || base === '/') return '';
    if (!base.startsWith('/')) return '';

    const trimmed = base.replace(/\/+$/u, '');
    return trimmed.length > 0 ? `${trimmed}/` : '';
}

function stripServeBasePath(pathname, serveBasePath) {
    if (!serveBasePath) return pathname;

    const baseWithoutTrailingSlash = serveBasePath.replace(/\/$/u, '');
    if (pathname === baseWithoutTrailingSlash) return '/';
    if (pathname.startsWith(serveBasePath)) {
        return `/${pathname.slice(serveBasePath.length)}`;
    }
    return pathname;
}

function contentTypeFor(filePath) {
    const extension = path.extname(filePath).toLowerCase();
    switch (extension) {
        case '.css': {
            return 'text/css; charset=utf-8';
        }
        case '.html': {
            return 'text/html; charset=utf-8';
        }
        case '.js':
        case '.mjs': {
            return 'text/javascript; charset=utf-8';
        }
        case '.json': {
            return 'application/json; charset=utf-8';
        }
        case '.svg': {
            return 'image/svg+xml';
        }
        default: {
            return 'application/octet-stream';
        }
    }
}

async function runRuntimeSmoke(url, expectedTexts) {
    const browser = await chromium.launch();
    const context = await browser.newContext({
        reducedMotion: 'reduce',
        viewport: { height: 720, width: 1280 },
    });
    const page = await context.newPage();
    const pageErrors = [];
    const consoleErrors = [];

    page.on('pageerror', (error) => {
        pageErrors.push(error.stack ?? error.message);
    });
    page.on('console', (message) => {
        if (message.type() === 'error') {
            consoleErrors.push(message.text());
        }
    });

    try {
        await page.goto(url, { waitUntil: 'networkidle' });
        await page.locator('canvas[role="application"][aria-label="Zerith visual novel player"]').waitFor({
            state: 'visible',
            timeout: 15_000,
        });

        for (const expectedText of expectedTexts) {
            await pressUntilStatusText(page, expectedText);
        }

        if (pageErrors.length > 0 || consoleErrors.length > 0) {
            throw new Error([
                'Runtime smoke saw browser errors:',
                ...pageErrors.map((error) => `pageerror: ${error}`),
                ...consoleErrors.map((error) => `console.error: ${error}`),
            ].join('\n'));
        }
    } finally {
        await browser.close();
    }
}

async function pressUntilStatusText(page, expectedText) {
    const deadline = Date.now() + 15_000;
    let lastError;
    let previousStatusTexts = await readStatusTexts(page);

    while (Date.now() < deadline) {
        await page.keyboard.press('Enter');
        try {
            await waitForStatusText(page, expectedText, 1_500);
            return;
        } catch (error) {
            lastError = error;
            const currentStatusTexts = await readStatusTexts(page);

            if (statusTextsInclude(currentStatusTexts, expectedText)) {
                return;
            }

            if (
                currentStatusTexts.length > 0
                && !statusTextsEqual(currentStatusTexts, previousStatusTexts)
            ) {
                throw new Error([
                    `Runtime advanced to unexpected status text while waiting for: ${expectedText}`,
                    `Previous status text(s): ${formatStatusTexts(previousStatusTexts)}`,
                    `Current status text(s): ${formatStatusTexts(currentStatusTexts)}`,
                    error instanceof Error ? error.message : String(error),
                ].join('\n'));
            }

            previousStatusTexts = currentStatusTexts;
        }
    }

    if (lastError) throw lastError;
    await waitForStatusText(page, expectedText, 1);
}

async function readStatusTexts(page) {
    return page
        .locator('[role="status"]')
        .evaluateAll((elements) => elements.map((element) => element.textContent ?? ''));
}

function statusTextsEqual(left, right) {
    return left.length === right.length && left.every((text, index) => text === right[index]);
}

function statusTextsInclude(statusTexts, expectedText) {
    return statusTexts.some((text) => text.includes(expectedText));
}

function formatStatusTexts(statusTexts) {
    return statusTexts.length > 0 ? statusTexts.join(' | ') : '(none)';
}

async function waitForStatusText(page, expectedText, timeout = 15_000) {
    try {
        await page.waitForFunction((text) => {
            return [...document.querySelectorAll('[role="status"]')]
                .some((element) => element.textContent?.includes(text));
        }, expectedText, { timeout });
    } catch (error) {
        const statusTexts = await readStatusTexts(page);
        throw new Error([
            `Timed out waiting for runtime status text: ${expectedText}`,
            `Current status text(s): ${formatStatusTexts(statusTexts)}`,
            error instanceof Error ? error.message : String(error),
        ].join('\n'));
    }
}

async function run() {
    const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const repoRoot = path.resolve(packageRoot, '..', '..');
    const args = parseArgs(process.argv.slice(2));
    const gamePath = toAbsolutePath(args.game ?? 'games/classic-vn-starter', repoRoot);
    const gameName = path.basename(gamePath);
    const expectedTexts = args.expectedTexts.length > 0
        ? args.expectedTexts
        : DEFAULT_EXPECTED_TEXTS;
    const outDir = toAbsolutePath(args.outDir, repoRoot)
        ?? path.resolve(repoRoot, 'dist', 'runtime-smoke', gameName);

    if (!fs.existsSync(path.join(gamePath, 'game.json'))) {
        throw new Error(`Game path must contain a game.json manifest: ${gamePath}`);
    }

    await ensureExportedGame({
        base: args.base,
        gamePath,
        outDir,
        packageRoot,
        repoRoot,
        skipBuild: args.skipBuild,
    });

    const configSnapshot = snapshotRuntimeConfig(outDir);
    let server;
    try {
        enableRuntimeSmokeAccessibility(outDir);
        server = await createStaticServer(outDir, args.base);
        await runRuntimeSmoke(server.url, expectedTexts);
    } finally {
        let closeError;
        if (server) {
            try {
                await server.close();
            } catch (error) {
                closeError = error;
            }
        }
        restoreRuntimeConfig(configSnapshot);
        if (closeError) {
            throw closeError;
        }
    }

    process.stdout.write(`Exported runtime smoke passed for ${gamePath} at ${outDir} (${expectedTexts.length} dialogue assertion(s)).\n`);
}

run().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
});

import { spawnSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const requiredFiles = [
    'index.html',
    'package.json',
    'scripts/build-game.mjs',
    'scripts/content-compiler.mjs',
    'src/main.ts',
    'src/runtime/bootstrapConfig.ts',
    'src/runtime/bootstrapPlayer.ts',
    'src/runtime/compiledContentPrefetch.ts',
    'src/runtime/playerAccessibility.ts',
    'vite.config.ts',
    'README.md',
    'LICENSE',
];

export async function inspectPlayerPackage(directory) {
    try {
        const manifest = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
        // Some npm versions run prepare even for a dry run with ignore-scripts.
        if (manifest.scripts?.prepare) throw new Error('Player prepare hooks are not supported by read-only package inspection.');
        const runtimeEntries = await readdir(path.join(directory, 'src/runtime'), { withFileTypes: true });
        const expected = new Set([
            ...requiredFiles,
            ...runtimeEntries
                .filter((entry) => entry.isFile() && /\.(?:ts|css)$/u.test(entry.name))
                .map((entry) => `src/runtime/${entry.name}`),
        ]);
        const command = 'npm pack --dry-run --json --ignore-scripts --offline';
        const result = process.platform === 'win32'
            ? spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', command], packOptions(directory))
            : spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts', '--offline'], packOptions(directory));
        if (result.error) throw result.error;
        if (result.status !== 0) throw new Error(result.stderr.trim() || `npm pack exited with ${result.status}.`);
        const packages = JSON.parse(result.stdout);
        if (!Array.isArray(packages) || packages.length !== 1 || !Array.isArray(packages[0].files)) {
            throw new Error('npm pack did not return one package file list.');
        }
        const files = packages[0].files.map((file) => file.path);
        if (files.some((file) => typeof file !== 'string')) throw new Error('npm pack returned an invalid file path.');
        const packed = new Set(files);
        const missing = [...expected].filter((file) => !packed.has(file)).sort();
        const unexpected = [...packed].filter((file) => !expected.has(file)).sort();
        return { files: files.sort(), missing, ready: missing.length === 0 && unexpected.length === 0, unexpected };
    } catch (error) {
        return { error: error.message, files: [], missing: [], ready: false, unexpected: [] };
    }
}

export function playerPackageContentsDetail(contents) {
    if (contents.error) return `Cannot inspect player package: ${contents.error}`;
    return [
        contents.missing.length > 0 ? `Missing packed files: ${contents.missing.join(', ')}.` : '',
        contents.unexpected.length > 0 ? `Unexpected packed files: ${contents.unexpected.join(', ')}.` : '',
    ].filter(Boolean).join(' ') || 'The player tarball contains the required shell and build inputs.';
}

function packOptions(directory) {
    return {
        cwd: directory,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
        timeout: 30_000,
        windowsHide: true,
    };
}

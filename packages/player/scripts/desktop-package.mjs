import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { zipSync } from 'fflate';

const playerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const metadataName = 'zerith.desktop.json';
const runtimeError = 'Prebuilt player missing or invalid. Reinstall the editor or provide a valid desktop runtime with --runtimeDir';

function metadataText(value, fallback, field) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text && fallback) return fallback;
    if (!text || Buffer.byteLength(text) > 256 || /[\x00-\x1f\x7f-\x9f]/.test(text)) {
        throw new Error(`Desktop ${field} must contain 1 to 256 UTF-8 bytes without control characters`);
    }
    return text;
}

export function desktopIdentity(manifest) {
    const title = metadataText(manifest.title, 'Game', 'title');
    const seed = manifest.id === undefined ? title : metadataText(manifest.id, undefined, 'game id');
    const slug = seed.replaceAll(/[A-Z]/g, (letter) => letter.toLowerCase()).replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/^-|-$/g, '').slice(0, 48).replaceAll('-', '') || 'game';
    const digest = createHash('sha256').update(seed).digest('hex').slice(0, 12);
    return { identifier: `games.${slug}.g${digest}`, title };
}

export function desktopMetadata(manifest, config = {}) {
    const { identifier: gameId, title } = desktopIdentity(manifest);
    const dimension = (value, fallback, minimum) => Number.isInteger(value) && value >= minimum && value <= 8192 ? value : fallback;
    return { formatVersion: 1, gameId, title, width: dimension(config?.display?.width, 1280, 320), height: dimension(config?.display?.height, 720, 240) };
}

export function assertNewDesktopDestination(game, out) {
    const gameRoot = fs.realpathSync(game);
    let ancestor = out;
    while (!fs.existsSync(ancestor)) {
        const next = path.dirname(ancestor);
        if (next === ancestor) throw new Error('Desktop output has no existing parent');
        ancestor = next;
    }
    for (let current = ancestor; ; current = path.dirname(current)) {
        if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Desktop output contains a symbolic link');
        if (path.dirname(current) === current) break;
    }
    const resolved = path.join(fs.realpathSync(ancestor), path.relative(ancestor, out));
    const overlaps = (left, right) => {
        const relative = path.relative(left, right);
        return !relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
    };
    if (overlaps(gameRoot, resolved) || overlaps(resolved, gameRoot)) throw new Error('Desktop output must be outside the project directory');
    if (fs.existsSync(out)) throw new Error(`Desktop output already exists: ${out}. Choose a new destination`);
}

export function validateDesktopRuntime(runtimeDir = path.join(playerRoot, 'desktop-runtime', `${process.platform}-${process.arch}`)) {
    try {
        const manifestFile = path.join(runtimeDir, 'runtime.json');
        if (fs.statSync(manifestFile).size > 64 * 1024) throw new Error('runtime manifest is too large');
        const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
        const executable = process.platform === 'win32' ? 'game-player.exe' : 'game-player';
        if (manifest.formatVersion !== 1 || manifest.platform !== process.platform || manifest.arch !== process.arch
            || manifest.executable !== executable || manifest.runtimeVersion !== '0.1.0' || !/^[0-9a-f]{64}$/.test(manifest.sha256)) {
            throw new Error('runtime manifest does not match this platform and architecture');
        }
        const source = path.join(runtimeDir, executable);
        if (!fs.lstatSync(source).isFile()) throw new Error('runtime executable must be a regular file');
        const bytes = fs.readFileSync(source);
        if (!bytes.length || createHash('sha256').update(bytes).digest('hex') !== manifest.sha256) throw new Error('runtime executable checksum does not match');
        return { executable, bytes };
    } catch (error) {
        throw new Error(`${runtimeError}\n${runtimeDir}: ${error.message}`);
    }
}

export function runCommand(command, args, options = {}) {
    const result = spawnSync(command, args, { encoding: 'utf8', ...options });
    if (result.error) throw new Error(`Cannot run ${command}: ${result.error.message}`);
    if (result.status !== 0) throw new Error(`${command} failed\n${result.stderr || result.stdout || 'See the export output above'}`);
    return result;
}

function collectEntries(web, current, entries, paths, totals) {
    for (const name of fs.readdirSync(current).sort()) {
        const source = path.join(current, name);
        const relative = path.relative(web, source).split(path.sep).join('/');
        const lower = relative.toLowerCase();
        if (lower === '__proto__' || Buffer.byteLength(relative) > 2048 || /[\\:%?#\x00-\x1f\x7f-\x9f]/.test(relative)
            || lower.split('/').some(segment => !segment || ['.', '..', '.dev_docs', '.git', 'node_modules'].includes(segment))) {
            throw new Error(`Unsafe desktop payload path: ${relative}`);
        }
        if (lower === metadataName || lower.startsWith(`${metadataName}/`)) throw new Error(`Desktop metadata path is reserved: ${relative}`);
        if (paths.has(lower)) throw new Error(`Duplicate desktop payload path: ${relative}`);
        paths.add(lower);
        const stat = fs.lstatSync(source);
        if (stat.isSymbolicLink()) throw new Error(`Desktop payload contains a symbolic link: ${relative}`);
        if (stat.isDirectory()) collectEntries(web, source, entries, paths, totals);
        else if (stat.isFile()) {
            if (stat.size > 1024 ** 3) throw new Error(`Desktop payload file exceeds 1 GiB: ${relative}`);
            totals.bytes += stat.size;
            totals.files += 1;
            if (totals.files > 65_535) throw new Error('Desktop CLI payload exceeds 65535 files. Use the native editor export for larger projects');
            if (totals.bytes > 0xffffffff) throw new Error('Desktop payload exceeds the CLI 4 GiB ZIP limit');
            entries[relative] = [fs.readFileSync(source), { mtime: new Date(1980, 0, 1) }];
        } else throw new Error(`Desktop payload is not a regular file: ${relative}`);
    }
}

export function writeDesktopPackage(out, runtime, metadata) {
    const entries = Object.create(null);
    const metadataBytes = Buffer.from(JSON.stringify(metadata, null, 2));
    collectEntries(path.join(out, 'web'), path.join(out, 'web'), entries, new Set(), { bytes: metadataBytes.length, files: 1 });
    for (const required of ['index.html', 'game.json', 'zerith.content.json']) {
        if (!entries[required]) throw new Error(`Desktop payload is missing ${required}`);
    }
    entries[metadataName] = [metadataBytes, { mtime: new Date(1980, 0, 1) }];
    const archive = zipSync(entries, { level: 9 });
    if (archive.length > 0xffffffff) throw new Error('Desktop archive exceeds the CLI 4 GiB ZIP limit');
    fs.writeFileSync(path.join(out, 'game.zpack'), archive, { flag: 'wx' });
    const executable = path.join(out, runtime.executable);
    fs.writeFileSync(executable, runtime.bytes, { flag: 'wx', mode: 0o755 });
    if (process.platform !== 'win32') fs.chmodSync(executable, 0o755);
    return executable;
}

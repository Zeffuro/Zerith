import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const playerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function runtimePlatform(target, platform = process.platform, arch = process.arch) {
    if (target) {
        arch = target.startsWith('x86_64-') ? 'x64' : target.startsWith('aarch64-') ? 'arm64' : undefined;
        platform = target.endsWith('-apple-darwin') ? 'darwin'
            : target.includes('-windows-') ? 'win32'
                : target.includes('-linux-') ? 'linux' : undefined;
    }
    if (!['win32', 'darwin', 'linux'].includes(platform) || !['x64', 'arm64'].includes(arch)) {
        throw new Error(`Unsupported desktop runtime target: ${target || `${platform}-${arch}`}`);
    }
    return { platform, arch, executable: platform === 'win32' ? 'game-player.exe' : 'game-player' };
}

function assertGeneratedDestination(directory, identity) {
    for (let current = directory; ; current = path.dirname(current)) {
        if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) {
            throw new Error('Desktop runtime output contains a symbolic link');
        }
        if (path.dirname(current) === current) break;
    }
    const manifestPath = path.join(directory, 'runtime.json');
    const executablePath = path.join(directory, identity.executable);
    if (!fs.existsSync(manifestPath) && !fs.existsSync(executablePath)) return;
    if (!fs.existsSync(manifestPath) || !fs.existsSync(executablePath)) {
        throw new Error('Existing desktop runtime is incomplete. Preserve it and choose another output directory');
    }
    for (const file of [manifestPath, executablePath]) {
        if (!fs.lstatSync(file).isFile() || fs.lstatSync(file).isSymbolicLink()) {
            throw new Error('Desktop runtime artifacts must be regular files');
        }
    }
    if (fs.statSync(manifestPath).size > 65536) throw new Error('Desktop runtime manifest is too large');
    const previous = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (previous.formatVersion !== 1 || previous.platform !== identity.platform || previous.arch !== identity.arch
        || previous.executable !== identity.executable || previous.runtimeVersion !== '0.1.0'
        || !/^[a-f0-9]{64}$/.test(previous.sha256)) {
        throw new Error('Existing output is not a matching generated desktop runtime');
    }
    if (fs.statSync(executablePath).size > 256 * 1024 * 1024
        || createHash('sha256').update(fs.readFileSync(executablePath)).digest('hex') !== previous.sha256) {
        throw new Error('Existing desktop runtime checksum differs. Preserve it and choose another output directory');
    }
}

function atomicWrite(destination, bytes, mode) {
    const temporary = `${destination}.${randomUUID()}.tmp`;
    fs.writeFileSync(temporary, bytes, { flag: 'wx', mode });
    fs.renameSync(temporary, destination);
}

export function buildDesktopRuntime({ target, debug = false, outputRoot, targetDir } = {}) {
    const identity = runtimePlatform(target);
    const directory = path.join(path.resolve(outputRoot || path.join(playerRoot, 'desktop-runtime')), `${identity.platform}-${identity.arch}`);
    assertGeneratedDestination(directory, identity);
    const cache = path.resolve(targetDir || process.env.CARGO_TARGET_DIR || path.join(os.tmpdir(), 'zerith-desktop-player-target'));
    const shell = path.join(playerRoot, 'desktop-shell');
    const result = spawnSync('cargo', ['build', '--locked', ...(debug ? [] : ['--release']),
        ...(target ? ['--target', target] : []), '--manifest-path', path.join(shell, 'Cargo.toml')], {
        cwd: shell, env: { ...process.env, CARGO_INCREMENTAL: '0', CARGO_TARGET_DIR: cache }, stdio: 'inherit',
    });
    if (result.error) throw new Error(`Cannot build desktop runtime: ${result.error.message}`);
    if (result.status !== 0) throw new Error('Desktop runtime build failed. See the build output above');
    const built = path.join(cache, ...(target ? [target] : []), debug ? 'debug' : 'release', identity.executable);
    const bytes = fs.readFileSync(built);
    const manifest = { formatVersion: 1, ...identity, sha256: createHash('sha256').update(bytes).digest('hex'), runtimeVersion: '0.1.0' };
    fs.mkdirSync(directory, { recursive: true });
    assertGeneratedDestination(directory, identity);
    atomicWrite(path.join(directory, identity.executable), bytes, 0o755);
    atomicWrite(path.join(directory, 'runtime.json'), `${JSON.stringify(manifest, null, 2)}\n`, 0o644);
    return directory;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const options = {};
    for (let index = 2; index < process.argv.length; index++) {
        const argument = process.argv[index];
        if (argument === '--debug') options.debug = true;
        else if (['--target', '--output-root', '--target-dir'].includes(argument)) {
            const value = process.argv[++index];
            if (!value || value.startsWith('--')) throw new Error(`Missing value for ${argument}`);
            options[argument === '--target' ? 'target' : argument === '--output-root' ? 'outputRoot' : 'targetDir'] = value;
        } else throw new Error(`Unknown argument: ${argument}`);
    }
    console.log(`Desktop runtime ready: ${buildDesktopRuntime(options)}`);
}

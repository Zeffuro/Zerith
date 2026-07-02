import { spawnSync } from 'node:child_process';
import { access, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const corePackageName = '@zeffuro/zerith-core';
const playerPackageName = '@zeffuro/zerith-player';
const packageName = process.argv[2] ?? corePackageName;
const supportedPackages = new Set([corePackageName, playerPackageName]);

if (!supportedPackages.has(packageName)) {
    console.error(`Unsupported npm smoke package: ${packageName}`);
    process.exit(1);
}

const packagesToPack = packageName === playerPackageName
    ? [corePackageName, playerPackageName]
    : [packageName];
const smokeRoot = path.join(root, 'temp', 'npm-smoke', packageName.replaceAll('/', '-'));

await rm(smokeRoot, { force: true, recursive: true });
await mkdir(smokeRoot, { recursive: true });

const tarballPaths = [];
for (const packageToPack of packagesToPack) {
    const workspace = packageNameToWorkspace(packageToPack);
    const workspacePath = path.join(root, workspace);

    run('npm', ['run', 'build', `--workspace=${packageToPack}`]);

    const packOutput = run('npm', [
        'pack',
        '--json',
        '--pack-destination',
        smokeRoot,
    ], { cwd: workspacePath });
    const packEntries = JSON.parse(packOutput.stdout);
    const packedFileName = packEntries[0]?.filename;
    if (typeof packedFileName !== 'string' || packedFileName.length === 0) {
        throw new Error(`npm pack did not return a tarball filename for ${packageToPack}.`);
    }

    tarballPaths.push(path.join(smokeRoot, packedFileName));
}

await writeFile(
    path.join(smokeRoot, 'package.json'),
    `${JSON.stringify({ private: true, type: 'module' }, undefined, 2)}\n`,
);

run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', ...tarballPaths], { cwd: smokeRoot });

if (packageName === corePackageName) {
    await writeCoreRuntimeSmoke(smokeRoot);
    run(process.execPath, ['smoke.mjs'], { cwd: smokeRoot });

    await writeCoreTypeSmoke(smokeRoot);
    run(process.execPath, [
        path.join(root, 'node_modules/typescript/bin/tsc'),
        '--module',
        'NodeNext',
        '--moduleResolution',
        'NodeNext',
        '--noEmit',
        '--skipLibCheck',
        '--strict',
        '--target',
        'ES2022',
        'smoke.ts',
    ], { cwd: smokeRoot });
}

if (packageName === playerPackageName) {
    await runPlayerCliSmoke(smokeRoot);
}

console.log(`${packageName} packed tarball consumer smoke passed.`);

function packageNameToWorkspace(name) {
    if (name === corePackageName) return 'packages/core';
    if (name === playerPackageName) return 'packages/player';
    throw new Error(`No workspace mapped for ${name}.`);
}

function run(command, args, options = {}) {
    const shellCommand = resolveCommand(command, args);
    const result = spawnSync(shellCommand.command, shellCommand.args, {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        ...options,
    });

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        if (result.stdout) process.stdout.write(result.stdout);
        if (result.stderr) process.stderr.write(result.stderr);
        throw new Error(`Command failed: ${command} ${args.join(' ')}`);
    }

    return {
        stderr: result.stderr,
        stdout: result.stdout,
    };
}

function resolveCommand(command, args) {
    if (process.platform !== 'win32' || (command !== 'npm' && command !== 'npx')) {
        return { args, command };
    }

    return {
        args: ['/d', '/s', '/c', [command, ...args].map(quoteWindowsShellArgument).join(' ')],
        command: process.env.ComSpec ?? 'cmd.exe',
    };
}

function quoteWindowsShellArgument(value) {
    if (!/[ \t"&|<>^]/u.test(value)) return value;
    return `"${value.replaceAll('"', '\\"')}"`;
}

async function writeCoreRuntimeSmoke(targetDirectory) {
    await writeFile(path.join(targetDirectory, 'smoke.mjs'), `
import { parseSceneFile } from '@zeffuro/zerith-core/schemas';
import { BuiltInCommandTypes, createDefaultSystemState } from '@zeffuro/zerith-core/types';
import { analyzeStoryGraph } from '@zeffuro/zerith-core/utils/StoryGraph';

const { commands } = parseSceneFile([{ speaker: 'Ada', text: 'Hello', type: 'dialogue' }]);
const state = createDefaultSystemState();
const graph = analyzeStoryGraph({ intro: commands }, { startScene: 'intro' });

if (!BuiltInCommandTypes.includes('dialogue')) throw new Error('Missing dialogue command type.');
if (state.items.length !== 0) throw new Error('Default state did not initialize items.');
if (!graph.reachableScenes.includes('intro')) throw new Error('Story graph did not preserve reachable start scene.');
`, 'utf8');
}

async function writeCoreTypeSmoke(targetDirectory) {
    await writeFile(path.join(targetDirectory, 'smoke.ts'), `
import type { BaseCommand, Script } from '@zeffuro/zerith-core';
import { parseSceneFile } from '@zeffuro/zerith-core/schemas';
import { analyzeStoryGraph } from '@zeffuro/zerith-core/utils/StoryGraph';

const parsed: Script = parseSceneFile([{ speaker: 'Ada', text: 'Hello', type: 'dialogue' }]).commands;
const command: BaseCommand = parsed[0] ?? { type: 'wait' };
const graph = analyzeStoryGraph({ intro: [command] }, { startScene: 'intro' });

if (!graph.reachableScenes.includes('intro')) throw new Error('Unexpected graph start scene.');
`, 'utf8');
}

async function runPlayerCliSmoke(targetDirectory) {
    const gamePath = path.join(targetDirectory, 'game');
    const outputPath = path.join(targetDirectory, 'dist', 'game');
    const zipPath = path.join(targetDirectory, 'dist', 'game.zip');
    await cp(path.join(root, 'games/classic-vn-starter'), gamePath, { recursive: true });

    run('npm', [
        'exec',
        '--',
        'zerith-player',
        '--game=game',
        '--outDir=dist/game',
        '--base=./',
        '--zip',
        '--zipFile=dist/game.zip',
    ], { cwd: targetDirectory });

    await access(path.join(outputPath, 'index.html'));
    await access(path.join(outputPath, 'assets'));
    await access(zipPath);

    const compiled = JSON.parse(await readFile(path.join(outputPath, 'zerith.content.json'), 'utf8'));
    if (compiled.compilerVersion !== 1) {
        throw new Error('Player CLI smoke produced an unexpected compiled content manifest.');
    }
}

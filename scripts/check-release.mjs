import { spawnSync } from 'node:child_process';

const node = process.execPath;
const checks = [
    [node, ['scripts/report-version-policy.mjs', '--json']],
    [node, ['scripts/report-editor-updater.mjs', '--json']],
    [node, ['scripts/report-editor-distribution.mjs', '--json']],
    [node, ['scripts/report-npm-publication.mjs', '--json']],
    [node, ['scripts/report-package-publication.mjs', '--json']],
    [node, ['scripts/report-release.mjs', '--json']],
    ['npm', ['run', 'check:public']],
    ['npm', ['run', 'test:fixture-policy']],
    ['npm', ['run', 'test:npm-core']],
    ['npm', ['run', 'test:npm-player']],
    ['npm', ['run', 'lint']],
    ['npm', ['run', 'build', '--workspace=zerith-editor']],
    ['cargo', ['check'], { cwd: 'packages/editor/src-tauri' }],
];

for (const [command, args, options] of checks) {
    run(command, args, options);
}

console.log('Release check passed.');

function run(command, args, options = {}) {
    console.log(`> ${formatCommandForLog(command)} ${args.join(' ')}`);
    const shellCommand = resolveCommand(command, args);
    const result = spawnSync(shellCommand.command, shellCommand.args, {
        encoding: 'utf8',
        stdio: 'inherit',
        windowsHide: true,
        ...options,
    });

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

function formatCommandForLog(command) {
    return command === process.execPath ? 'node' : command;
}

function resolveCommand(command, args) {
    if (process.platform !== 'win32' || command !== 'npm') {
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

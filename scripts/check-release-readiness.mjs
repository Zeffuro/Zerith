import { spawnSync } from 'node:child_process';

const checks = [
    ['npm', ['run', 'report:version-policy', '--', '--json']],
    ['npm', ['run', 'report:editor-updater', '--', '--json']],
    ['npm', ['run', 'report:editor-distribution', '--', '--json']],
    ['npm', ['run', 'report:npm-publication', '--', '--json']],
    ['npm', ['run', 'report:package-publication', '--', '--json']],
    ['npm', ['run', 'report:release-readiness', '--', '--json']],
    ['npm', ['run', 'test:public-readiness']],
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

console.log('Release readiness check passed.');

function run(command, args, options = {}) {
    console.log(`> ${command} ${args.join(' ')}`);
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

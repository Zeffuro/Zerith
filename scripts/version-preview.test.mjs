import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const files = [
    'package.json', 'package-lock.json', 'packages/editor/package.json',
    'packages/core/package.json', 'packages/player/package.json',
    'packages/editor/src-tauri/Cargo.toml', 'packages/editor/src-tauri/Cargo.lock',
    'packages/editor/src-tauri/tauri.conf.json',
];

for (const script of ['bump-editor-version.mjs', 'bump-npm-package-versions.mjs']) {
    for (const mode of ['npm preview', 'argument preview', 'actual bump']) {
        test(`${script}: ${mode} preserves the intended write contract`, async t => {
            const tempRoot = await realpath(os.tmpdir());
            const directory = await mkdtemp(path.join(tempRoot, 'zerith-version-preview-'));
            t.after(async () => {
                assert.equal(await realpath(directory), directory);
                assert.equal(path.dirname(directory), tempRoot);
                await rm(directory, { recursive: true });
            });
            const before = new Map();
            for (const name of files) {
                const target = path.join(directory, name);
                await mkdir(path.dirname(target), { recursive: true });
                await cp(path.join(root, name), target);
                before.set(name, await readFile(target));
            }
            const args = [path.join(root, 'scripts', script), 'patch'];
            if (mode === 'argument preview') args.push('--dry-run');
            const result = spawnSync(process.execPath, args, {
                cwd: directory, encoding: 'utf8', windowsHide: true,
                env: { ...process.env, npm_config_dry_run: mode === 'npm preview' ? 'true' : 'false' },
            });
            assert.ifError(result.error);
            assert.equal(result.status, 0, result.stderr);
            const changed = [];
            for (const name of files) {
                if (!(await readFile(path.join(directory, name))).equals(before.get(name))) changed.push(name);
            }
            if (mode !== 'actual bump') {
                assert.match(result.stdout, /Would bump/);
                assert.deepEqual(changed, []);
            } else {
                assert.match(result.stdout, /Bumped/);
                assert.equal(changed.length, script === 'bump-editor-version.mjs' ? 5 : 3);
                const target = script === 'bump-editor-version.mjs' ? 'packages/editor/package.json' : 'packages/core/package.json';
                const oldVersion = JSON.parse(before.get(target).toString()).version;
                const current = JSON.parse(await readFile(path.join(directory, target), 'utf8'));
                const [major, minor, patch] = oldVersion.split('.').map(Number);
                assert.equal(current.version, `${major}.${minor}.${patch + 1}`);
            }
        });
    }
}

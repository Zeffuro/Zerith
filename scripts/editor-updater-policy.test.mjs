import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('..', import.meta.url));

test('release gate rejects missing, false and nonboolean signed-version protection', async (t) => {
    const temporaryRoot = await realpath(os.tmpdir());
    const directory = await mkdtemp(path.join(temporaryRoot, 'zerith-updater-policy-'));
    t.after(async () => {
        assert.equal(path.dirname(directory), temporaryRoot);
        assert.equal(await realpath(directory), directory);
        await rm(directory, { recursive: true, force: true });
    });
    for (const relative of ['packages/editor/src', '.github/workflows']) {
        await mkdir(path.dirname(path.join(directory, relative)), { recursive: true });
        await cp(path.join(root, relative), path.join(directory, relative), { recursive: true });
    }
    for (const relative of [
        'packages/editor/package.json', 'packages/editor/src-tauri/tauri.conf.json',
        'packages/editor/src-tauri/Cargo.toml', 'packages/editor/src-tauri/src/lib.rs',
        'packages/editor/src-tauri/capabilities/default.json',
    ]) {
        await mkdir(path.dirname(path.join(directory, relative)), { recursive: true });
        await cp(path.join(root, relative), path.join(directory, relative));
    }
    const configPath = path.join(directory, 'packages/editor/src-tauri/tauri.conf.json');
    const config = JSON.parse(await readFile(configPath, 'utf8'));
    for (const value of [true, undefined, false, 'true']) {
        if (value === undefined) delete config.plugins.updater.requireSignedVersion;
        else config.plugins.updater.requireSignedVersion = value;
        await writeFile(configPath, JSON.stringify(config));
        const result = spawnSync(process.execPath, [path.join(root, 'scripts/report-editor-updater.mjs'), '--json'], {
            cwd: directory, encoding: 'utf8', windowsHide: true, timeout: 30_000,
        });
        assert.ifError(result.error);
        assert.equal(result.stderr, '');
        const report = JSON.parse(result.stdout);
        const check = report.checks.find((entry) => entry.id === 'signedUpdateVersion');
        assert.equal(check?.status, value === true ? 'ready' : 'blocked');
        assert.equal(report.status, value === true ? 'ready' : 'blocked');
        assert.equal(result.status, value === true ? 0 : 1);
    }
});

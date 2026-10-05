import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildDesktopRuntime, runtimePlatform } from './build-desktop-runtime.mjs';

function createTestScratch(t) {
    const root = fs.realpathSync(os.tmpdir());
    const directory = fs.mkdtempSync(path.join(root, 'zerith-runtime-contract-'));
    const identity = fs.lstatSync(directory, { bigint: true });
    t.after(() => {
        if (process.env.ZERITH_KEEP_TEST_PROFILES === '1') {
            console.warn(`Test scratch retained: ${directory}`);
            return;
        }
        const current = fs.lstatSync(directory, { bigint: true });
        assert.equal(path.dirname(directory), root);
        assert.ok(current.isDirectory() && !current.isSymbolicLink());
        assert.equal(current.dev, identity.dev);
        assert.equal(current.ino, identity.ino);
        assert.equal(fs.realpathSync(root), root);
        assert.equal(fs.realpathSync(directory), directory);
        fs.rmSync(directory, { force: true, recursive: true, maxRetries: 5, retryDelay: 100 });
    });
    return directory;
}

test('desktop runtime target metadata follows the target instead of the build host', () => {
    assert.deepEqual(runtimePlatform('x86_64-apple-darwin', 'win32', 'arm64'), { platform: 'darwin', arch: 'x64', executable: 'game-player' });
    assert.deepEqual(runtimePlatform('aarch64-apple-darwin'), { platform: 'darwin', arch: 'arm64', executable: 'game-player' });
    assert.deepEqual(runtimePlatform('x86_64-pc-windows-msvc'), { platform: 'win32', arch: 'x64', executable: 'game-player.exe' });
    assert.deepEqual(runtimePlatform('aarch64-unknown-linux-gnu'), { platform: 'linux', arch: 'arm64', executable: 'game-player' });
    assert.deepEqual(runtimePlatform(undefined, 'linux', 'x64'), { platform: 'linux', arch: 'x64', executable: 'game-player' });
    assert.throws(() => runtimePlatform('i686-unknown-linux-gnu'), /Unsupported/);
    assert.throws(() => runtimePlatform('x86_64-unknown-freebsd'), /Unsupported/);
});

test('runtime build refuses to overwrite an unrelated or changed artifact before invoking Cargo', (t) => {
    const outputRoot = createTestScratch(t);
    const identity = runtimePlatform();
    const directory = path.join(outputRoot, `${identity.platform}-${identity.arch}`);
    fs.mkdirSync(directory);
    const executable = path.join(directory, identity.executable);
    fs.writeFileSync(executable, 'preserve');
    assert.throws(() => buildDesktopRuntime({ outputRoot }), /incomplete/);
    const manifest = { formatVersion: 1, ...identity, runtimeVersion: '0.1.0', sha256: createHash('sha256').update('original').digest('hex') };
    fs.writeFileSync(path.join(directory, 'runtime.json'), JSON.stringify(manifest));
    assert.throws(() => buildDesktopRuntime({ outputRoot }), /checksum differs/);
    assert.equal(fs.readFileSync(executable, 'utf8'), 'preserve');
    manifest.arch = identity.arch === 'x64' ? 'arm64' : 'x64';
    fs.writeFileSync(path.join(directory, 'runtime.json'), JSON.stringify(manifest));
    assert.throws(() => buildDesktopRuntime({ outputRoot }), /not a matching/);
    assert.equal(fs.readFileSync(executable, 'utf8'), 'preserve');
});

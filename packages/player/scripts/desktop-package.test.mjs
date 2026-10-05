import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { unzipSync } from 'fflate';

import { assertNewDesktopDestination, desktopMetadata, desktopIdentity, validateDesktopRuntime, writeDesktopPackage } from './desktop-package.mjs';

const game = path.resolve('games/classic-vn-starter');
const executable = process.platform === 'win32' ? 'game-player.exe' : 'game-player';
const binary = Buffer.from('fixture compiled player bytes');

function createTestScratch(t) {
    const root = fs.realpathSync(os.tmpdir());
    const directory = fs.mkdtempSync(path.join(root, 'zerith-desktop-contract-'));
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

function runtimeFixture(fixtures, name, overrides = {}) {
    const directory = path.join(fixtures, name);
    fs.mkdirSync(directory);
    fs.writeFileSync(path.join(directory, executable), binary);
    fs.writeFileSync(path.join(directory, 'runtime.json'), JSON.stringify({
        formatVersion: 1, platform: process.platform, arch: process.arch, executable,
        sha256: createHash('sha256').update(binary).digest('hex'), runtimeVersion: '0.1.0', ...overrides,
    }));
    return directory;
}

function webFixture(fixtures, name) {
    const out = path.join(fixtures, name);
    fs.mkdirSync(path.join(out, 'web/assets'), { recursive: true });
    for (const [name, bytes] of Object.entries({ 'index.html': '<html>player</html>', 'game.json': '{"title":"Fixture"}', 'zerith.content.json': '{}', 'assets/game.js': 'compiled player code' })) {
        fs.writeFileSync(path.join(out, 'web', name), bytes);
    }
    return out;
}

test('game identity remains stable and explicit ids isolate same-title games across retitles', () => {
    assert.equal(desktopIdentity({ title: 'Classic VN Starter' }).identifier, 'games.classicvnstarter.g16af32adf16f');
    assert.match(desktopIdentity({ title: 'İ日本語K' }).identifier, /^games\.game\.g/);
    const first = desktopIdentity({ title: 'Shared Title', id: 'first-game' });
    assert.notEqual(first.identifier, desktopIdentity({ title: 'Shared Title', id: 'second-game' }).identifier);
    assert.equal(first.identifier, desktopIdentity({ title: 'Renamed Game', id: 'first-game' }).identifier);
    assert.throws(() => desktopIdentity({ id: '' }), /game id/);
    assert.throws(() => desktopIdentity({ title: 'bad\u0000title' }), /control characters/);
    assert.throws(() => desktopIdentity({ title: '界'.repeat(86) }), /256 UTF-8/);
});

test('metadata reads bounded display dimensions with sensible defaults', () => {
    assert.deepEqual(desktopMetadata({ title: 'Fixture' }, { display: { width: 800, height: 600 } }), {
        formatVersion: 1, gameId: desktopIdentity({ title: 'Fixture' }).identifier, title: 'Fixture', width: 800, height: 600,
    });
    assert.equal(desktopMetadata({}, { display: { width: 99, height: 99999 } }).width, 1280);
    assert.equal(desktopMetadata({}, { display: { height: 240.5 } }).height, 720);
});

test('existing outputs, project overlap and junction aliases preserve existing files', (t) => {
    const fixtures = createTestScratch(t);
    const out = path.join(fixtures, 'existing');
    fs.mkdirSync(out);
    fs.writeFileSync(path.join(out, 'save.json'), 'keep this save');
    assert.throws(() => assertNewDesktopDestination(game, out), /already exists/);
    assert.equal(fs.readFileSync(path.join(out, 'save.json'), 'utf8'), 'keep this save');
    assert.throws(() => assertNewDesktopDestination(game, path.join(game, 'desktop')), /outside the project/);
    assert.throws(() => assertNewDesktopDestination(game, path.dirname(game)), /outside the project/);
    const alias = path.join(fixtures, 'project-alias');
    fs.symlinkSync(game, alias, process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => assertNewDesktopDestination(game, path.join(alias, 'desktop')), /symbolic link/);
});

test('prebuilt runtime validation checks target, format, version and checksum', (t) => {
    const fixtures = createTestScratch(t);
    assert.deepEqual(validateDesktopRuntime(runtimeFixture(fixtures, 'valid')).bytes, binary);
    for (const [name, override] of Object.entries({ platform: { platform: 'other' }, arch: { arch: 'other' }, format: { formatVersion: 2 }, version: { runtimeVersion: 'other' }, executable: { executable: '../game-player' }, hash: { sha256: '0'.repeat(64) } })) {
        assert.throws(() => validateDesktopRuntime(runtimeFixture(fixtures, name, override)), /Prebuilt player missing or invalid/);
    }
    const malformed = runtimeFixture(fixtures, 'malformed');
    fs.writeFileSync(path.join(malformed, 'runtime.json'), '{');
    assert.throws(() => validateDesktopRuntime(malformed), /Reinstall/);
    assert.throws(() => validateDesktopRuntime(path.join(fixtures, 'absent')), /Reinstall/);
});

test('packages copy unchanged runtime bytes and deterministic complete game data exclusively', (t) => {
    const fixtures = createTestScratch(t);
    const runtime = validateDesktopRuntime(runtimeFixture(fixtures, 'package-runtime'));
    const metadata = desktopMetadata({ title: 'Fixture' });
    const first = webFixture(fixtures, 'package-one');
    const second = webFixture(fixtures, 'package-two');
    const result = writeDesktopPackage(first, runtime, metadata);
    writeDesktopPackage(second, runtime, metadata);
    assert.deepEqual(fs.readFileSync(result), binary);
    const archiveBytes = fs.readFileSync(path.join(first, 'game.zpack'));
    assert.equal(archiveBytes.readUInt16LE(10), 0);
    assert.equal(archiveBytes.readUInt16LE(12), 0x21);
    assert.deepEqual(fs.readFileSync(path.join(first, 'game.zpack')), fs.readFileSync(path.join(second, 'game.zpack')));
    const files = unzipSync(fs.readFileSync(path.join(first, 'game.zpack')));
    assert.deepEqual(Object.keys(files).sort(), ['assets/game.js', 'game.json', 'index.html', 'zerith.content.json', 'zerith.desktop.json']);
    assert.deepEqual(JSON.parse(Buffer.from(files['zerith.desktop.json']).toString()), metadata);
    assert.equal(Buffer.from(files['assets/game.js']).toString(), 'compiled player code');
    assert.throws(() => writeDesktopPackage(first, runtime, metadata), /EEXIST/);
    assert.equal(fs.existsSync(path.join(first, 'package-source')), false);
    assert.equal(fs.existsSync(path.join(first, 'desktop-build.log')), false);
    if (process.platform !== 'win32') assert.equal(fs.statSync(result).mode & 0o777, 0o755);
});

test('reserved metadata conflicts retain payload and produce no archive or executable', (t) => {
    const fixtures = createTestScratch(t);
    const out = webFixture(fixtures, 'metadata-conflict');
    fs.writeFileSync(path.join(out, 'web/ZERITH.DESKTOP.JSON'), 'preserve');
    assert.throws(() => writeDesktopPackage(out, validateDesktopRuntime(runtimeFixture(fixtures, 'conflict-runtime')), desktopMetadata({})), /reserved/);
    assert.equal(fs.readFileSync(path.join(out, 'web/ZERITH.DESKTOP.JSON'), 'utf8'), 'preserve');
    assert.equal(fs.existsSync(path.join(out, 'game.zpack')), false);
    assert.equal(fs.existsSync(path.join(out, executable)), false);
});

test('unsafe URL paths cannot become unreadable or ambiguous desktop resources', (t) => {
    const fixtures = createTestScratch(t);
    for (const name of ['percent%20.txt', 'fragment#name.txt', '__proto__']) {
        const out = webFixture(fixtures, `unsafe-${name.slice(0, 4)}`);
        fs.writeFileSync(path.join(out, 'web', name), 'preserve');
        assert.throws(() => writeDesktopPackage(out, validateDesktopRuntime(runtimeFixture(fixtures, `unsafe-runtime-${name.slice(0, 4)}`)), desktopMetadata({})), /Unsafe desktop payload path/);
        assert.equal(fs.existsSync(path.join(out, 'game.zpack')), false);
        assert.equal(fs.readFileSync(path.join(out, 'web', name), 'utf8'), 'preserve');
    }
});

test('CLI rejects missing, malformed, wrong-target and checksum-invalid runtimes before reserving output without compiler PATH', (t) => {
    const fixtures = createTestScratch(t);
    const malformed = runtimeFixture(fixtures, 'cli-malformed');
    fs.writeFileSync(path.join(malformed, 'runtime.json'), '{}');
    const runtimes = [path.join(fixtures, 'missing-runtime'), malformed, runtimeFixture(fixtures, 'cli-platform', { platform: 'other' }), runtimeFixture(fixtures, 'cli-hash', { sha256: '0'.repeat(64) })];
    runtimes.forEach((runtimeDir, index) => {
        const out = path.join(fixtures, `cli-failure-${index}`);
        const result = spawnSync(process.execPath, ['packages/player/scripts/build-desktop-game.mjs', '--game', game, '--outDir', out, '--runtimeDir', runtimeDir], {
            encoding: 'utf8', env: { ...process.env, PATH: '' },
        });
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /Prebuilt player missing or invalid/);
        assert.doesNotMatch(result.stderr, /Rust|Cargo|toolchain/);
        assert.equal(fs.existsSync(out), false);
    });
});

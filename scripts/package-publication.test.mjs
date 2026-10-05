import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('..', import.meta.url));
const reportScripts = ['report-package-publication.mjs', 'report-npm-publication.mjs'];
const requiredShellFiles = [
    'index.html', 'scripts/build-game.mjs', 'scripts/content-compiler.mjs',
    'src/main.ts', 'vite.config.ts', 'README.md', 'LICENSE',
];

async function fixture(t) {
    const directory = await mkdtemp(path.join(await realpath(os.tmpdir()), 'zerith-publication-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    for (const filename of [
        'package.json', 'packages/core/package.json', 'packages/editor/package.json',
        'packages/player/package.json', '.github/workflows/npm-publish.yml',
        'scripts/bump-npm-package-versions.mjs',
    ]) {
        await mkdir(path.dirname(path.join(directory, filename)), { recursive: true });
        await cp(path.join(root, filename), path.join(directory, filename));
    }
    const player = path.join(directory, 'packages/player');
    const runtime = await readdir(path.join(root, 'packages/player/src/runtime'), { withFileTypes: true });
    const files = [
        ...requiredShellFiles,
        ...runtime.filter((entry) => entry.isFile() && /\.(?:ts|css)$/u.test(entry.name))
            .map((entry) => `src/runtime/${entry.name}`),
    ];
    for (const filename of files) {
        await mkdir(path.dirname(path.join(player, filename)), { recursive: true });
        await cp(path.join(root, 'packages/player', filename), path.join(player, filename));
    }
    return { directory, files, player };
}

async function updateManifest(directory, filename, change) {
    const target = path.join(directory, filename);
    const manifest = JSON.parse(await readFile(target, 'utf8'));
    change(manifest);
    await writeFile(target, `${JSON.stringify(manifest)}\n`);
}

function reports(directory, asJson = true) {
    return reportScripts.map((script) => {
        const result = spawnSync(process.execPath, [path.join(root, 'scripts', script), ...(asJson ? ['--json'] : [])], {
            cwd: directory, encoding: 'utf8', timeout: 45_000, windowsHide: true,
        });
        assert.ifError(result.error);
        assert.equal(result.stderr, '', `${script}: ${result.stderr}`);
        return { ...result, report: asJson ? JSON.parse(result.stdout) : undefined };
    });
}

function assertBlocked(results, detail) {
    for (const { report, status } of results) {
        assert.equal(status, 1);
        assert.equal(report.status, 'blocked');
        assert.ok(report.blocked > 0);
        if (detail) assert.ok(report.checks.some((check) => check.status === 'blocked' && check.detail.includes(detail)));
    }
}

test('runtime globs pack complete player inputs and limited registry checks succeed', async (t) => {
    const { directory } = await fixture(t);
    await updateManifest(directory, 'packages/player/package.json', (manifest) => {
        manifest.scripts.prepack = 'node -e "throw new Error(\'prepack must not run\')"';
        manifest.scripts.postpack = 'node -e "throw new Error(\'postpack must not run\')"';
    });
    const results = reports(directory);
    assert.deepEqual(results.map(({ status }) => status), [0, 0]);
    assert.equal(results[0].report.status, 'ready');
    assert.equal(results[1].report.status, 'limited');
    assert.equal(results[1].report.blocked, 0);
    assert.deepEqual(results[1].report.checks.filter((check) => check.status === 'limited').map((check) => check.id), [
        'registryNameReservation', 'playerPublishSequence',
    ]);
    assert.ok(!(await readdir(path.join(directory, 'packages/player'))).some((name) => name.endsWith('.tgz')));
});

test('literal file and directory allowlists use the same packed-file contract', async (t) => {
    const { directory, files } = await fixture(t);
    for (const allowlist of [files, [...requiredShellFiles, 'src/runtime']]) {
        await updateManifest(directory, 'packages/player/package.json', (manifest) => { manifest.files = allowlist; });
        for (const { report, status } of reports(directory)) {
            assert.equal(status, 0);
            assert.equal(report.blocked, 0);
        }
    }
});

test('prepare hooks fail closed without executing or writing files', async (t) => {
    const { directory, player } = await fixture(t);
    await updateManifest(directory, 'packages/player/package.json', (manifest) => {
        manifest.scripts.prepare = 'node -e "require(\'node:fs\').writeFileSync(\'prepare-ran\', \'unexpected\')"';
    });
    assertBlocked(reports(directory), 'Player prepare hooks are not supported');
    await assert.rejects(readFile(path.join(player, 'prepare-ran')), { code: 'ENOENT' });
});

test('missing or empty files allowlists block publication', async (t) => {
    const { directory } = await fixture(t);
    for (const files of [undefined, []]) {
        await updateManifest(directory, 'packages/player/package.json', (manifest) => { manifest.files = files; });
        assertBlocked(reports(directory));
    }
});

test('missing runtime glob fails both report commands', async (t) => {
    const { directory } = await fixture(t);
    await updateManifest(directory, 'packages/player/package.json', (manifest) => {
        manifest.files = manifest.files.filter((filename) => filename !== 'src/runtime/*.ts');
    });
    assertBlocked(reports(directory), 'Missing packed files:');
});

test('npm exclusions cannot hide a required runtime module', async (t) => {
    const { directory } = await fixture(t);
    await updateManifest(directory, 'packages/player/package.json', (manifest) => {
        manifest.files.push('!src/runtime/bootstrapPlayer.ts');
    });
    assertBlocked(reports(directory), 'src/runtime/bootstrapPlayer.ts');
});

test('missing source file is blocked even when its allowlist glob remains', async (t) => {
    const { directory, player } = await fixture(t);
    await rm(path.join(player, 'src/runtime/bootstrapConfig.ts'));
    assertBlocked(reports(directory), 'src/runtime/bootstrapConfig.ts');
});

test('missing shell CSS is blocked rather than producing a broken package', async (t) => {
    const { directory } = await fixture(t);
    await updateManifest(directory, 'packages/player/package.json', (manifest) => {
        manifest.files = manifest.files.filter((filename) => filename !== 'src/runtime/*.css');
    });
    assertBlocked(reports(directory), 'src/runtime/playerShell.css');
});

test('broad runtime directories cannot publish nested tests', async (t) => {
    const { directory, player } = await fixture(t);
    await mkdir(path.join(player, 'src/runtime/__tests__'));
    await writeFile(path.join(player, 'src/runtime/__tests__/private.test.ts'), 'export {};');
    await updateManifest(directory, 'packages/player/package.json', (manifest) => {
        manifest.files.push('src/runtime');
    });
    assertBlocked(reports(directory), 'Unexpected packed files: src/runtime/__tests__/private.test.ts');
});

test('root and editor publication guards cause failing exits', async (t) => {
    const { directory } = await fixture(t);
    for (const filename of ['package.json', 'packages/editor/package.json']) {
        await updateManifest(directory, filename, (manifest) => { manifest.private = false; });
        assertBlocked(reports(directory));
        await updateManifest(directory, filename, (manifest) => { manifest.private = true; });
    }
});

test('inspection errors are reported as blocked with a failing exit', async (t) => {
    const { directory, player } = await fixture(t);
    await rm(path.join(player, 'src/runtime'), { recursive: true });
    assertBlocked(reports(directory), 'Cannot inspect player package:');
});

test('text output has the same failing exit as JSON for blocked checks', async (t) => {
    const { directory } = await fixture(t);
    await updateManifest(directory, 'packages/player/package.json', (manifest) => { manifest.bin = {}; });
    for (const { stdout, status } of reports(directory, false)) {
        assert.equal(status, 1);
        assert.match(stdout, /publication checks: blocked/u);
    }
});

import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { closeTestContext, createTestProfile, persistentContextFixture } from '../packages/editor/visual-smoke/testProfiles.mjs';

const root = await mkdtemp(path.join(os.tmpdir(), 'zerith-profile-check-'));
const previousRoot = process.env.ZERITH_TEST_PROFILE_DIR;
const previousKeep = process.env.ZERITH_KEEP_TEST_PROFILES;
process.env.ZERITH_TEST_PROFILE_DIR = root;
delete process.env.ZERITH_KEEP_TEST_PROFILES;
after(async () => {
    if (previousRoot === undefined) delete process.env.ZERITH_TEST_PROFILE_DIR;
    else process.env.ZERITH_TEST_PROFILE_DIR = previousRoot;
    if (previousKeep === undefined) delete process.env.ZERITH_KEEP_TEST_PROFILES;
    else process.env.ZERITH_KEEP_TEST_PROFILES = previousKeep;
    assert.equal(path.dirname(root), os.tmpdir());
    await rm(root, { force: true, maxRetries: 5, recursive: true, retryDelay: 100 });
});

test('removes an owned profile without removing other output', async () => {
    await writeFile(path.join(root, 'receipt.json'), '{}');
    const profile = await createTestProfile('cleanup-');
    await writeFile(path.join(profile.directory, 'state.json'), '{}');
    await profile.dispose();
    assert.deepEqual(await readdir(root), ['receipt.json']);
});

test('closes the browser and removes its profile after a failed check', async () => {
    let browser;
    await assert.rejects(persistentContextFixture('failure-')({}, async context => {
        browser = context;
        throw new Error('Failed browser check');
    }, { project: { use: { viewport: { width: 640, height: 480 } } } }), /Failed browser check/u);
    assert.equal(browser.pages().length, 0);
    assert.deepEqual(await readdir(root), ['receipt.json']);
});

test('removes the profile when browser launch fails', async () => {
    const launch = chromium.launchPersistentContext;
    chromium.launchPersistentContext = async () => { throw new Error('Browser launch failed'); };
    try {
        await assert.rejects(persistentContextFixture('launch-')({}, async () => {}, { project: { use: {} } }), /Browser launch failed/u);
        assert.deepEqual(await readdir(root), ['receipt.json']);
    } finally {
        chromium.launchPersistentContext = launch;
    }
});

test('retains a profile only when explicitly requested', async () => {
    const profile = await createTestProfile('debug-');
    process.env.ZERITH_KEEP_TEST_PROFILES = '1';
    try {
        await profile.dispose();
        assert.ok((await readdir(root)).includes(path.basename(profile.directory)));
    } finally {
        delete process.env.ZERITH_KEEP_TEST_PROFILES;
        await profile.dispose();
    }
});

test('rejects a prefix that could escape the profile directory', async () => {
    await assert.rejects(createTestProfile('../other-'), /Invalid test profile prefix/u);
    assert.deepEqual(await readdir(root), ['receipt.json']);
});

test('retains the profile when browser closure is uncertain', async () => {
    const profile = await createTestProfile('close-');
    const failure = new Error('Closing failed');
    await assert.rejects(closeTestContext({ close: async () => { throw failure; } }, profile), error => error === failure);
    assert.ok((await readdir(root)).includes(path.basename(profile.directory)));
    await profile.dispose();
});

test('rejects a replaced profile directory and preserves its contents', async () => {
    const profile = await createTestProfile('identity-');
    const moved = `${profile.directory}-moved`;
    await rename(profile.directory, moved);
    await mkdir(profile.directory);
    const marker = path.join(profile.directory, 'unrelated.txt');
    await writeFile(marker, 'Retained');
    try {
        await assert.rejects(profile.dispose(), /Unexpected test profile path/u);
        assert.equal(await readFile(marker, 'utf8'), 'Retained');
    } finally {
        assert.equal(path.dirname(profile.directory), root);
        assert.equal(path.dirname(moved), root);
        await rm(profile.directory, { recursive: true });
        await rm(moved, { recursive: true });
    }
});

test('rejects a redirected parent junction and preserves unrelated files', async () => {
    const probe = await mkdtemp(path.join(root, 'junction-'));
    const configured = path.join(probe, 'profiles');
    const moved = path.join(probe, 'moved');
    const unrelated = path.join(probe, 'unrelated');
    process.env.ZERITH_TEST_PROFILE_DIR = configured;
    const profile = await createTestProfile('junction-');
    process.env.ZERITH_TEST_PROFILE_DIR = root;
    await rename(configured, moved);
    const target = path.join(unrelated, path.basename(profile.directory));
    await mkdir(target, { recursive: true });
    const marker = path.join(target, 'unrelated.txt');
    await writeFile(marker, 'Retained');
    await symlink(unrelated, configured, process.platform === 'win32' ? 'junction' : 'dir');
    try {
        await assert.rejects(profile.dispose(), /Unexpected test profile path/u);
        assert.equal(await readFile(marker, 'utf8'), 'Retained');
        assert.ok((await readdir(moved)).includes(path.basename(profile.directory)));
    } finally {
        await unlink(configured);
        assert.equal(path.dirname(probe), root);
        await rm(probe, { recursive: true });
    }
});

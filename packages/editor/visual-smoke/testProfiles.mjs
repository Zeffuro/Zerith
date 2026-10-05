import { chromium } from '@playwright/test';
import { lstat, mkdir, mkdtemp, realpath, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export async function createTestProfile(prefix) {
    if (!/^[a-z]+(?:-[a-z]+)*-$/u.test(prefix)) throw new Error('Invalid test profile prefix');
    const configuredRoot = process.env.ZERITH_TEST_PROFILE_DIR ?? path.join(os.tmpdir(), 'zerith-browser-tests');
    await mkdir(configuredRoot, { recursive: true });
    const root = await realpath(configuredRoot);
    const directory = await mkdtemp(path.join(root, prefix));
    const identity = await lstat(directory, { bigint: true });
    return {
        directory,
        async dispose() {
            if (process.env.ZERITH_KEEP_TEST_PROFILES === '1') return;
            const current = await lstat(directory, { bigint: true });
            if (path.dirname(directory) !== root || !current.isDirectory() || current.isSymbolicLink()
                || current.dev !== identity.dev || current.ino !== identity.ino
                || await realpath(root) !== root || await realpath(directory) !== directory) {
                throw new Error(`Unexpected test profile path: ${directory}`);
            }
            await rm(directory, { force: true, maxRetries: 5, recursive: true, retryDelay: 100 });
        },
    };
}

export async function closeTestContext(context, profile) {
    try {
        await context?.close();
    } catch (error) {
        console.warn(`Browser profile retained because closing failed: ${profile.directory}`);
        throw error;
    }
    await profile.dispose();
}

export function persistentContextFixture(prefix) {
    return async ({ baseURL }, use, info) => {
        const profile = await createTestProfile(prefix);
        let context;
        try {
            context = await chromium.launchPersistentContext(profile.directory, {
                args: ['--disable-audio-output'], baseURL, colorScheme: 'dark', headless: true,
                hasTouch: info.project.use.hasTouch, isMobile: info.project.use.isMobile,
                reducedMotion: 'reduce', viewport: info.project.use.viewport,
            });
            await use(context);
        } finally {
            await closeTestContext(context, profile);
        }
    };
}

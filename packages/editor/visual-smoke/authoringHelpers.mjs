import { test as baseTest } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { persistentContextFixture } from './testProfiles.mjs';

export const test = baseTest.extend({
    context: [persistentContextFixture('authoring-profile-'), { timeout: 45_000 }],
});

export async function readFixture(name) {
    const root = path.resolve('games', name);
    const files = {};
    async function visit(folder, prefix = '') {
        for (const entry of await readdir(folder, { withFileTypes: true })) {
            const relative = `${prefix}${entry.name}`;
            if (entry.isDirectory()) await visit(path.join(folder, entry.name), `${relative}/`);
            else files[relative] = (await readFile(path.join(folder, entry.name))).toString('base64');
        }
    }
    await visit(root);
    return files;
}

export function replaceJson(files, name, update) {
    const value = JSON.parse(Buffer.from(files[name], 'base64').toString('utf8'));
    files[name] = Buffer.from(JSON.stringify(update(value), undefined, 4)).toString('base64');
}

export async function mountFixture(page, files) {
    return page.evaluate(async files => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        const handle = await (await navigator.storage.getDirectory()).getDirectoryHandle(`authoring-${crypto.randomUUID()}`, { create: true });
        const root = await fs.recentProjects.mountPicked(handle);
        for (const [relative, base64] of Object.entries(files)) {
            const parts = relative.split('/');
            let folder = handle;
            for (const part of parts.slice(0, -1)) folder = await folder.getDirectoryHandle(part, { create: true });
            const stream = await (await folder.getFileHandle(parts.at(-1), { create: true })).createWritable();
            await stream.write(Uint8Array.from(atob(base64), c => c.charCodeAt(0)));
            await stream.close();
        }
        return root;
    }, files);
}

export async function openFixture(page, root) {
    await page.evaluate(async root => {
        const { executeOpenProjectInCurrentWindow } = await import('/src/store/actions/projectOpenActions.ts');
        await executeOpenProjectInCurrentWindow(`${root}/game.json`, { checkMigration: false, prompt: false });
    }, root);
}

export async function dock(page, id) {
    await page.evaluate(id => globalThis.dispatchEvent(new CustomEvent('zerith:dock-select', { detail: id })), id);
}

export async function setup(page) {
    await page.addInitScript(() => { globalThis.showDirectoryPicker ??= () => Promise.reject(new DOMException('Picker unavailable', 'AbortError')); });
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '', contentType: 'text/css' }));
    await page.goto('/');
    await page.locator('.zerith-dock-host').waitFor();
}

export async function previewState(page) {
    return page.evaluate(async () => {
        const { useEngineBridgeStore } = await import('/src/store/useEngineBridgeStore.ts');
        const { usePlaytestStore } = await import('/src/store/usePlaytestStore.ts');
        const engine = useEngineBridgeStore.getState().engine;
        return { choices: usePlaytestStore.getState().choices, inventory: engine?.items.serialize(), message: usePlaytestStore.getState().message,
            phase: usePlaytestStore.getState().phase, scene: engine?.currentSceneName, state: engine?.stateManager.state };
    });
}

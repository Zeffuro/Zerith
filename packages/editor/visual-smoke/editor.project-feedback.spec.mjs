import { expect, test as baseTest } from '@playwright/test';
import { persistentContextFixture } from './testProfiles.mjs';

const test = baseTest.extend({
    context: [persistentContextFixture('project-feedback-'), { timeout: 45_000 }],
});
const failures = new WeakMap();

test.beforeEach(async ({ page }) => {
    const errors = [];
    failures.set(page, errors);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
        if (message.type() === 'error' && !message.text().startsWith('Failed to load manifest:')) errors.push(message.text());
    });
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '', contentType: 'text/css' }));
    await page.addInitScript(() => {
        globalThis.showDirectoryPicker ??= () => Promise.reject(new DOMException('Picker not used', 'AbortError'));
    });
    await page.goto('/');
    await page.evaluate(async () => {
        const { browserFsAdapter: adapter } = await import('/src/services/fs/browserFsAdapter.ts');
        const { executeOpenProjectInCurrentWindow: open } = await import('/src/store/actions/projectOpenActions.ts');
        const { useProjectStore, useScriptStore } = await import('/src/store/storeBootstrap.ts');
        const { useSettingsStore } = await import('/src/store/useSettingsStore.ts');
        const { useWorkbenchStore } = await import('/src/store/useWorkbenchStore.ts');
        useSettingsStore.getState().setAutosaveEnabled(false);
        const handle = await (await navigator.storage.getDirectory()).getDirectoryHandle(`feedback-${crypto.randomUUID()}`, { create: true });
        const root = await adapter.recentProjects.mountPicked(handle);
        await adapter.writeTextFile(`${root}/game.json`, JSON.stringify({ schemaVersion: 2, title: 'Feedback project' }));
        await adapter.writeTextFile(`${root}/notes.txt`, 'Saved notes');
        if ((await open(`${root}/game.json`, { checkMigration: false })).status !== 'opened-current') throw Error('Setup failed');
        const path = `${root}/notes.txt`;
        useProjectStore.getState().markFileDirty(path);
        useWorkbenchStore.getState().openOrFocusTab({ dirty: true, id: path, kind: 'text', path, savedTextContent: 'Saved notes', textContent: 'Unsaved notes', title: 'notes.txt' });
        useScriptStore.getState().setScript([{ type: 'dialogue', text: 'Unsaved model' }]);
    });
});
test.afterEach(async ({ page }) => { expect(failures.get(page)).toEqual([]); });

test('shows recoverable refresh feedback and retains dirty models through retry', async ({ page }) => {
    const failed = await page.evaluate(async () => {
        const { browserFsAdapter: adapter } = await import('/src/services/fs/browserFsAdapter.ts');
        const { executeOpenProjectInCurrentWindow: open } = await import('/src/store/actions/projectOpenActions.ts');
        const { useProjectStore, useScriptStore } = await import('/src/store/storeBootstrap.ts');
        const { useWorkbenchStore } = await import('/src/store/useWorkbenchStore.ts');
        const before = useProjectStore.getState();
        const tabs = useWorkbenchStore.getState().tabs;
        const script = useScriptStore.getState().rootScript;
        const recents = adapter.recentProjects.getSnapshot();
        const manifestPath = `${before.projectPath}/game.json`;
        await adapter.writeTextFile(manifestPath, JSON.stringify({ schemaVersion: 2, title: 'Broken reference', scenes: { intro: 'missing.json' } }));
        const result = await open(manifestPath, { checkMigration: false });
        return {
            status: result.status, retainedProject: useProjectStore.getState() === before,
            retainedTabs: useWorkbenchStore.getState().tabs === tabs,
            retainedScript: useScriptStore.getState().rootScript === script,
            retainedRecents: adapter.recentProjects.getSnapshot() === recents,
            saved: await adapter.readTextFile(`${before.projectPath}/notes.txt`),
        };
    });
    expect(failed).toEqual({ status: 'cancelled', retainedProject: true, retainedTabs: true, retainedScript: true, retainedRecents: true, saved: 'Saved notes' });
    await expect(page.getByRole('status').filter({ hasText: 'Could not refresh project.' })).toBeVisible();
    const retried = await page.evaluate(async () => {
        const { browserFsAdapter: adapter } = await import('/src/services/fs/browserFsAdapter.ts');
        const { executeOpenProjectInCurrentWindow: open } = await import('/src/store/actions/projectOpenActions.ts');
        const { useProjectStore, useScriptStore } = await import('/src/store/storeBootstrap.ts');
        const { useWorkbenchStore } = await import('/src/store/useWorkbenchStore.ts');
        const before = useProjectStore.getState();
        const tabs = useWorkbenchStore.getState().tabs;
        const script = useScriptStore.getState().rootScript;
        const manifestPath = `${before.projectPath}/game.json`;
        await adapter.writeTextFile(manifestPath, JSON.stringify({ schemaVersion: 2, title: 'Recovered project' }));
        const result = await open(manifestPath, { checkMigration: false });
        const after = useProjectStore.getState();
        return {
            status: result.status, title: after.manifest.title,
            retainedSession: before.projectGeneration === after.projectGeneration && before.projectPath === after.projectPath,
            retainedDirty: before.dirtyFiles === after.dirtyFiles,
            retainedTabs: useWorkbenchStore.getState().tabs === tabs,
            retainedScript: useScriptStore.getState().rootScript === script,
            saved: await adapter.readTextFile(`${after.projectPath}/notes.txt`),
        };
    });
    expect(retried).toEqual({ status: 'opened-current', title: 'Recovered project', retainedSession: true, retainedDirty: true, retainedTabs: true, retainedScript: true, saved: 'Saved notes' });
});

for (const phase of ['preflight', 'refresh', 'storage']) {
    test(`ignores obsolete ${phase} feedback after a newer same-project request`, async ({ page }) => {
        const result = await page.evaluate(async phase => {
            const { browserFsAdapter: adapter } = await import('/src/services/fs/browserFsAdapter.ts');
            const { executeOpenProjectInCurrentWindow: open } = await import('/src/store/actions/projectOpenActions.ts');
            const { useProjectStore } = await import('/src/store/storeBootstrap.ts');
            const { useEditorStore } = await import('/src/store/useEditorStore.ts');
            const { useWorkbenchStore } = await import('/src/store/useWorkbenchStore.ts');
            const manifestPath = `${useProjectStore.getState().projectPath}/game.json`;
            const target = phase === 'storage' ? adapter.recentProjects : adapter;
            const method = phase === 'storage' ? 'remember' : phase === 'refresh' ? 'readTextFile' : 'prepareProject';
            const original = target[method];
            let fail, started;
            const pending = new Promise((_, reject) => { fail = reject; });
            const entered = new Promise(resolve => { started = resolve; });
            target[method] = () => { target[method] = original; started(); return pending; };
            try {
                const older = open(manifestPath, { checkMigration: false });
                await entered;
                const newer = await open(manifestPath, { checkMigration: false });
                useEditorStore.getState().announceOperationStatus('Current project ready.', 'success');
                const status = useEditorStore.getState().lastOperationStatus;
                const project = useProjectStore.getState();
                const tabs = useWorkbenchStore.getState().tabs;
                const recents = adapter.recentProjects.getSnapshot();
                fail(new Error('Obsolete operation failed'));
                const stale = await older;
                return {
                    newer: newer.status, stale: stale.status,
                    retainedStatus: useEditorStore.getState().lastOperationStatus === status,
                    retainedProject: useProjectStore.getState() === project,
                    retainedTabs: useWorkbenchStore.getState().tabs === tabs,
                    retainedRecents: adapter.recentProjects.getSnapshot() === recents,
                };
            } finally { target[method] = original; }
        }, phase);
        expect(result).toEqual({ newer: 'opened-current', stale: 'cancelled', retainedStatus: true, retainedProject: true, retainedTabs: true, retainedRecents: true });
        await expect(page.getByRole('status').filter({ hasText: 'Current project ready.' })).toBeVisible();
    });
}

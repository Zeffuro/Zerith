import { expect } from '@playwright/test';
import { mountFixture, setup, test } from './authoringHelpers.mjs';
import { button, clean, countFor, fixture, frames, gate, install, noPublication, prepare, release, replace,
    sheet, snapshot, started, verify, workflows } from './audioExportOwnershipHelpers.mjs';

test.beforeEach(async ({ page }) => {
    page.__audioErrors = [];
    page.on('pageerror', error => page.__audioErrors.push(error.message));
    page.on('console', message => {
        if (message.type() === 'error' && !message.text().startsWith(page.__allowedAudioError ?? '\u0000')) page.__audioErrors.push(message.text());
    });
    await page.addInitScript(() => {
        globalThis.__audioRejections = [];
        globalThis.addEventListener('unhandledrejection', event => globalThis.__audioRejections.push(String(event.reason)));
    });
    await setup(page);
    await page.evaluate(async () => {
        const { useSettingsStore } = await import('/src/store/useSettingsStore.ts');
        useSettingsStore.getState().setRecoveryEnabled(false);
        useSettingsStore.getState().setAutosaveEnabled(false);
    });
});

test.afterEach(async ({ page }) => {
    await clean(page);
    expect(page.__audioErrors).toEqual([]);
    expect(await page.evaluate(() => globalThis.__audioRejections)).toEqual([]);
    await page.goto('about:blank');
});

async function start(page, workflow, id) {
    await button(page, workflow).click();
    await started(page, id);
    await expect(button(page, workflow)).toBeDisabled();
}

async function success(page, workflow, count) {
    await expect(page.getByText(workflow === 'selection' ? /^Saved .*\/assets\/audio-regions\//u : /Saved \d+ cue WAV/u)).toBeVisible();
    if (workflow !== 'selection') await expect(button(page, workflow)).toBeEnabled();
    await verify(page, count);
}

async function successor(page, root, workflow) {
    await prepare(page, root, workflow);
    const id = await gate(page, 'readDirectory', `${root}/assets/audio-regions`);
    await start(page, workflow, id);
    return id;
}

for (const name of ['classic-vn-starter', 'example-game']) {
    for (const workflow of workflows) {
        test(`${name}: ${workflow} recovers from ordinary failure and suppresses synchronous duplicates`, async ({ page }) => {
            const { root } = await fixture(page, name);
            await prepare(page, root, workflow);
            await install(page);
            if (workflow === 'review visible') page.__allowedAudioError = 'Failed to export audiosheet cues:';
            const failure = await gate(page, 'write', undefined, true);
            await start(page, workflow, failure);
            await release(page, failure);
            await expect(page.getByText(workflow === 'review visible' ? /1 sheet failed/u : /Deferred audio export denied/u)).toBeVisible();
            await expect(button(page, workflow)).toBeEnabled();
            const partial = workflow === 'review visible' ? 1 : 0;
            await verify(page, partial);
            const pending = await gate(page, 'readDirectory', `${root}/assets/audio-regions`);
            await button(page, workflow).evaluate(element => { element.click(); element.click(); });
            await started(page, pending);
            await expect(button(page, workflow)).toBeDisabled();
            await release(page, pending);
            await success(page, workflow, partial + countFor(workflow));
            expect((await snapshot(page)).attempts).toBe(1 + partial + countFor(workflow));
        });

        for (const replacement of ['same path', 'different path']) {
            test(`${name}: ${workflow} ignores old listing ${replacement === 'same path' ? 'success' : 'failure'} while successor owns busy`, async ({ page }) => {
                const { root, files } = await fixture(page, name);
                const next = replacement === 'same path' ? root : await mountFixture(page, files);
                await prepare(page, root, workflow);
                await install(page);
                const old = await gate(page, 'readDirectory', `${root}/assets/audio-regions`, replacement === 'different path');
                await start(page, workflow, old);
                await replace(page, next);
                const current = await successor(page, next, workflow);
                const baseline = await snapshot(page);
                await release(page, old);
                await noPublication(page, workflow, baseline);
                await release(page, current);
                await success(page, workflow, countFor(workflow));
                const saved = await verify(page, countFor(workflow));
                expect(saved.every(entry => entry.path.startsWith(`${next}/`))).toBe(true);
            });
        }

        test(`${name}: ${workflow} retires on source or caller lifetime replacement and allows a fresh run`, async ({ page }) => {
            const { root } = await fixture(page, name);
            await prepare(page, root, workflow);
            await install(page);
            const old = await gate(page, 'readDirectory', `${root}/assets/audio-regions`, true);
            await start(page, workflow, old);
            if (workflow === 'selection') {
                await prepare(page, root, workflow, '/assets/ownership-other.wav');
            } else if (workflow === 'editor batch') {
                await page.evaluate(async () => {
                    const { useWorkbenchStore } = await import('/src/store/useWorkbenchStore.ts');
                    useWorkbenchStore.getState().closeTab(useWorkbenchStore.getState().activeTabId);
                });
                await frames(page);
                await prepare(page, root, workflow);
            } else {
                await page.evaluate(async () => {
                    const { closeProject } = await import('/src/store/actions/projectOpenActions.ts');
                    closeProject();
                });
                await frames(page);
                await replace(page, root);
                await prepare(page, root, workflow);
            }
            const current = await gate(page, 'readDirectory', `${root}/assets/audio-regions`);
            await start(page, workflow, current);
            const baseline = await snapshot(page);
            await release(page, old);
            await noPublication(page, workflow, baseline);
            await release(page, current);
            await success(page, workflow, countFor(workflow));
        });

        test(`${name}: ${workflow} aborts a retired real browser stream before committing WAV bytes`, async ({ page }) => {
            const { root } = await fixture(page, name);
            await prepare(page, root, workflow);
            await install(page);
            const old = await gate(page, 'stream');
            await start(page, workflow, old);
            await replace(page, root);
            const current = await successor(page, root, workflow);
            const baseline = await snapshot(page);
            await release(page, old);
            await expect.poll(() => page.evaluate(() => globalThis.__audioOwned.aborts)).toBe(1);
            await noPublication(page, workflow, baseline);
            const abandoned = await page.evaluate(async () => {
                const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
                return (await fs.readBinaryFile(globalThis.__audioOwned.attempts[0].path)).length;
            });
            expect(abandoned).toBe(0);
            await release(page, current);
            await success(page, workflow, countFor(workflow));
        });

        test(`${name}: ${workflow} drops retired scanner completion after committed WAVs`, async ({ page }) => {
            const { root } = await fixture(page, name);
            await prepare(page, root, workflow);
            await install(page);
            const old = await gate(page, 'refresh', `${root}/assets`, false, countFor(workflow));
            await start(page, workflow, old);
            const original = await verify(page, countFor(workflow));
            await replace(page, root);
            const current = await successor(page, root, workflow);
            const baseline = await snapshot(page);
            await release(page, old);
            await noPublication(page, workflow, baseline);
            await release(page, current);
            await success(page, workflow, countFor(workflow) * 2);
            const final = await verify(page, countFor(workflow) * 2);
            expect(final.slice(0, original.length)).toEqual(original);
        });
    }

    for (const workflow of workflows.filter(value => value !== 'selection')) {
        test(`${name}: ${workflow} retains completed cue bytes and stops before the next cue or sheet`, async ({ page }) => {
            const { root } = await fixture(page, name);
            await prepare(page, root, workflow);
            await install(page);
            const committed = workflow === 'review visible' ? 2 : 1;
            const old = await gate(page, 'committed', undefined, false, committed);
            await start(page, workflow, old);
            const original = await verify(page, committed);
            await replace(page, root);
            const current = await successor(page, root, workflow);
            const baseline = await snapshot(page);
            await release(page, old);
            await noPublication(page, workflow, baseline);
            await release(page, current);
            await success(page, workflow, committed + countFor(workflow));
            const final = await verify(page, committed + countFor(workflow));
            expect(final.slice(0, committed)).toEqual(original);
        });
    }

    for (const [workflow, boundary] of [['review single', 'readTextFile'], ['review visible', 'decode']]) {
        test(`${name}: ${workflow} rejects retirement during actual ${boundary === 'decode' ? 'decode' : 'descriptor read'} completion`, async ({ page }) => {
            const { root } = await fixture(page, name);
            await prepare(page, root, workflow);
            await install(page);
            const old = await gate(page, boundary, boundary === 'readTextFile' ? `${root}${sheet}` : undefined);
            await start(page, workflow, old);
            await replace(page, root);
            const current = await successor(page, root, workflow);
            const baseline = await snapshot(page);
            await release(page, old);
            await noPublication(page, workflow, baseline);
            await release(page, current);
            await success(page, workflow, countFor(workflow));
        });
    }
}

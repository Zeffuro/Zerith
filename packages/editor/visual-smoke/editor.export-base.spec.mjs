import { expect } from '@playwright/test';
import { unzipSync } from 'fflate';
import { readFile } from 'node:fs/promises';

import { mountFixture, openFixture, readFixture, replaceJson, setup, test } from './authoringHelpers.mjs';

const bases = [
    { base: '/published-game', prefix: '/published-game/', label: 'host path' },
    { base: './content/', prefix: '/launch/content/', label: 'relative path' },
    { base: 'http://127.0.0.1:1423/published-game/', prefix: '/published-game/', label: 'cross-origin URL' },
];

for (const fixture of ['classic-vn-starter', 'example-game']) {
    for (const { base, prefix, label } of bases) {
        test(`loads ${fixture} browser export from a ${label}`, async ({ page }) => {
            await setup(page);
            const source = await readFixture(fixture);
            replaceJson(source, 'engine.config.json', config => ({ ...config, accessibility: { ...config.accessibility, captions: true, typewriterSpeedMultiplier: 0, reducedMotion: true } }));
            await openFixture(page, await mountFixture(page, source));
            await page.evaluate(async () => {
                const { useEditorStore } = await import('/src/store/useEditorStore.ts');
                useEditorStore.getState().openExportGameModal();
            });
            const dialog = page.getByRole('dialog', { name: 'Export Game' });
            await dialog.getByLabel('Export for').selectOption('generic-web');
            await dialog.getByText('Advanced', { exact: true }).click();
            await dialog.getByLabel('Base URL').fill(base);
            const downloading = page.waitForEvent('download');
            await dialog.getByRole('button', { name: 'Export', exact: true }).click();
            const files = unzipSync(await readFile(await (await downloading).path()));
            const runtime = await page.context().newPage();
            const errors = [];
            const missing = [];
            runtime.on('pageerror', error => errors.push(error.message));
            await runtime.route('**/*', async route => {
                const url = new URL(route.request().url());
                if (url.pathname === '/favicon.ico') return route.fulfill({ status: 204 });
                if (!['http://127.0.0.1:1422', 'http://127.0.0.1:1423'].includes(url.origin)) return route.fulfill({ body: '', contentType: 'text/css' });
                const name = url.pathname === '/launch/index.html' ? 'index.html'
                    : url.pathname.startsWith(prefix) ? decodeURIComponent(url.pathname.slice(prefix.length)) : undefined;
                const bytes = files[name];
                if (!bytes) { missing.push(url.pathname); return route.fulfill({ status: 404 }); }
                const type = name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css'
                    : name.endsWith('.svg') ? 'image/svg+xml' : name.endsWith('.png') ? 'image/png'
                        : name.endsWith('.wav') ? 'audio/wav' : name.endsWith('.html') ? 'text/html' : 'application/json';
                await route.fulfill({ body: Buffer.from(bytes), contentType: type, headers: { 'Access-Control-Allow-Origin': '*' } });
            });
            await runtime.goto('http://127.0.0.1:1422/launch/index.html');
            await runtime.getByRole('button', { name: 'New Game', exact: true }).click();
            const firstLine = fixture === 'classic-vn-starter' ? 'Every classic visual novel starts with a room, a choice, and a promise.' : 'Rain on the glass, two case files on the desk, and one very patient renderer.';
            await expect(runtime.locator('[role="status"]').filter({ hasText: firstLine })).toHaveCount(1);
            await runtime.locator('canvas').click();
            if (fixture === 'example-game') await runtime.locator('canvas').click();
            const secondLine = fixture === 'classic-vn-starter' ? 'The promise is simple: every line should be easy to find again.' : 'I moved everything clean into this folder. No borrowed cast, no mystery licenses, no surprise assets.';
            await expect(runtime.locator('[role="status"]').filter({ hasText: secondLine })).toHaveCount(1);
            expect(missing).toEqual([]);
            expect(errors).toEqual([]);
            await runtime.close();
        });
    }
}

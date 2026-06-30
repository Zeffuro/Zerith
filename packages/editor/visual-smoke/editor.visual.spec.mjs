import { expect, test } from '@playwright/test';

const screenshotOptions = {
    animations: 'disabled',
    caret: 'hide',
    fullPage: false,
};

test.describe('editor visual smoke', () => {
    test.beforeEach(async ({ page }) => {
        await blockRemoteFonts(page);
        await page.addInitScript(() => {
            localStorage.clear();
        });
        await page.goto('/');
        await page.locator('.zerith-dock-host').waitFor();
        await callVisualSmokeHarness(page, 'resetEditorChrome');
        await settleEditor(page);
    });

    test('captures the default shell and dense dock panels', async ({ page }) => {
        await expect(page).toHaveScreenshot('editor-shell.png', screenshotOptions);

        await callVisualSmokeHarness(page, 'selectDockPanel', 'project_validation');
        await expect(page.getByText('Open a project to validate content.')).toBeVisible();
        await settleEditor(page);
        await expect(page).toHaveScreenshot('project-validation-panel.png', screenshotOptions);

        await callVisualSmokeHarness(page, 'selectDockPanel', 'git');
        await expect(page.getByText('Open a project to inspect Git status.')).toBeVisible();
        await settleEditor(page);
        await expect(page).toHaveScreenshot('git-panel.png', screenshotOptions);
    });

    test('captures keyboard modal surfaces and global live status', async ({ page }) => {
        await callVisualSmokeHarness(page, 'openCommandPalette');
        await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible();
        await settleEditor(page);
        await expect(page).toHaveScreenshot('command-palette.png', screenshotOptions);

        await callVisualSmokeHarness(page, 'closeCommandPalette');
        await callVisualSmokeHarness(page, 'openSettingsModal');
        await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
        await page.getByPlaceholder('Search settings').fill('screen reader');
        await expect(page.getByText('Screen Reader Mode')).toBeVisible();
        await settleEditor(page);
        await expect(page).toHaveScreenshot('settings-editor-accessibility.png', screenshotOptions);

        await callVisualSmokeHarness(page, 'closeSettingsModal');
        await callVisualSmokeHarness(page, 'openNewProjectModal');
        await expect(page.getByRole('dialog', { name: 'New Project' })).toBeVisible();
        await settleEditor(page);
        await expect(page).toHaveScreenshot('new-project-modal.png', screenshotOptions);

        await callVisualSmokeHarness(page, 'closeNewProjectModal');
        await callVisualSmokeHarness(page, 'openExportGameModal');
        await expect(page.getByRole('dialog', { name: 'Export Game' })).toBeVisible();
        await expect(page.getByRole('status')).toContainText('Open a project first to export.');
        await settleEditor(page);
        await expect(page).toHaveScreenshot('export-modal-empty-project.png', screenshotOptions);

        await callVisualSmokeHarness(page, 'closeExportGameModal');
        await callVisualSmokeHarness(
            page,
            'announceOperationStatus',
            'Content migration checked the project and found no changes.',
        );
        await expect(page.getByRole('status')).toContainText('Content migration checked the project');
        await settleEditor(page);
        await expect(page).toHaveScreenshot('global-live-operation-status.png', screenshotOptions);
    });
});

async function blockRemoteFonts(page) {
    await page.route('https://fonts.googleapis.com/**', async (route) => {
        await route.fulfill({
            body: '',
            contentType: 'text/css',
            status: 200,
        });
    });
    await page.route('https://fonts.gstatic.com/**', async (route) => {
        await route.abort();
    });
}

async function callVisualSmokeHarness(page, action, ...args) {
    await page.waitForFunction(() => Boolean(window.__ZERITH_EDITOR_VISUAL_SMOKE__));
    await page.evaluate(
        ([actionName, actionArguments]) => {
            const harness = window.__ZERITH_EDITOR_VISUAL_SMOKE__;
            harness?.[actionName]?.(...actionArguments);
        },
        [action, args],
    );
}

async function settleEditor(page) {
    await page.evaluate(async () => {
        await document.fonts?.ready;
    });
    await page.waitForTimeout(150);
}

import { expect, test } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

    test('covers no-project new-project routing without creating files', async ({ page }) => {
        await callVisualSmokeHarness(page, 'selectDockPanel', 'project_validation');
        await expect(page.getByText('Open a project to validate content.')).toBeVisible();
        await callVisualSmokeHarness(page, 'selectDockPanel', 'asset_dependencies');
        await expect(page.getByText('Open a project to analyze assets.')).toBeVisible();
        await callVisualSmokeHarness(page, 'selectDockPanel', 'reference_tracker');
        await expect(page.getByText('Open a project to scan references.')).toBeVisible();

        await callVisualSmokeHarness(page, 'openCommandPalette');
        const commandPalette = page.getByRole('dialog', { name: 'Command palette' });
        await expect(commandPalette).toBeVisible();
        await commandPalette.getByPlaceholder('Type an action (e.g. Save All, Play, Reset Layout)').fill('new project');
        await expect(commandPalette.getByRole('option', { name: /New Project/u })).toBeVisible();
        await commandPalette.getByRole('option', { name: /New Project/u }).click();

        await expect(commandPalette).toHaveCount(0);
        const newProjectDialog = page.getByRole('dialog', { name: 'New Project' });
        await expect(newProjectDialog).toBeVisible();
        await expect(newProjectDialog.getByLabel('Project Name')).toHaveValue('My New Game');
        await expect(newProjectDialog.getByRole('button', { name: 'Create Project' })).toBeDisabled();

        await newProjectDialog.getByRole('radio', { name: /Classic VN/u }).click();
        await expect(newProjectDialog.getByLabel('Project Name')).toHaveValue('Classic VN Starter');
        await expect(newProjectDialog).toContainText('Classic VN sample with scenes, characters, localization, and SVG placeholder assets.');
        await expect(newProjectDialog).toContainText('Localization-ready');
        await expect(newProjectDialog).toContainText('Branch-ready');
        await expect(newProjectDialog).toContainText('Asset-ready');
        await expect(newProjectDialog.getByRole('status')).toContainText('Classic VN opens /scenes/intro.json after creation.');
        await expect(newProjectDialog.getByRole('button', { name: 'Create Project' })).toBeDisabled();

        await newProjectDialog.getByRole('button', { name: 'Cancel' }).click();
        await expect(newProjectDialog).toHaveCount(0);
        await expect(page.getByText('Open a project to scan references.')).toBeVisible();

        await callVisualSmokeHarness(page, 'openCommandPalette');
        const reopenedPalette = page.getByRole('dialog', { name: 'Command palette' });
        await reopenedPalette.getByPlaceholder('Type an action (e.g. Save All, Play, Reset Layout)').fill('export game');
        const disabledExport = reopenedPalette.getByRole('option', { name: /Export Game/u });
        await expect(disabledExport).toBeDisabled();
        await expect(disabledExport).toContainText('Open a project first.');
        await reopenedPalette.getByPlaceholder('Type an action (e.g. Save All, Play, Reset Layout)').fill('playback stop');
        const disabledStop = reopenedPalette.getByRole('option', { name: /Playback: Stop/u });
        await expect(disabledStop).toBeDisabled();
        await expect(disabledStop).toContainText('Start preview playback first.');
        await callVisualSmokeHarness(page, 'closeCommandPalette');
        await expect(reopenedPalette).toHaveCount(0);
    });

    test('covers settings plugin marketplace status without loading plugins', async ({ page }) => {
        await callVisualSmokeHarness(page, 'openSettingsModal');
        const settingsDialog = page.getByRole('dialog', { name: 'Settings' });
        await expect(settingsDialog).toBeVisible();

        await settingsDialog.getByRole('button', { name: 'Plugins' }).click();

        const marketplaceStatus = settingsDialog.getByLabel('Plugin marketplace status');
        await expect(marketplaceStatus).toContainText('Marketplace blocked');
        await expect(marketplaceStatus).toContainText('Manifest trust policy');
        await expect(marketplaceStatus).toContainText('limited');
        await expect(marketplaceStatus).toContainText('Package integrity');
        await expect(settingsDialog.getByText('No manifest inspected.')).toBeVisible();

        await callVisualSmokeHarness(page, 'closeSettingsModal');
        await expect(settingsDialog).toHaveCount(0);
    });

    test('covers settings plugin local deactivation without loading external packages', async ({ page }) => {
        await callVisualSmokeHarness(page, 'registerVisualSmokePlugin');
        await callVisualSmokeHarness(page, 'openSettingsModal');
        const settingsDialog = page.getByRole('dialog', { name: 'Settings' });
        await expect(settingsDialog).toBeVisible();

        await settingsDialog.getByRole('button', { name: 'Plugins' }).click();
        const pluginRow = settingsDialog.locator('article').filter({ hasText: 'Visual Smoke Plugin' });
        await expect(pluginRow).toContainText('Active');
        await expect(pluginRow).toContainText('visual-smoke-memory');

        await settingsDialog.getByRole('button', { name: 'Deactivate plugin Visual Smoke Plugin' }).click();

        await expect(pluginRow).toContainText('Inactive');
        await expect(settingsDialog.getByRole('button', { name: 'Deactivate plugin Visual Smoke Plugin' })).toHaveCount(0);

        await callVisualSmokeHarness(page, 'closeSettingsModal');
        await expect(settingsDialog).toHaveCount(0);
    });

    test('covers command palette browser parity report without opening a project', async ({ page }) => {
        await callVisualSmokeHarness(page, 'openCommandPalette');
        const commandPalette = page.getByRole('dialog', { name: 'Command palette' });
        await expect(commandPalette).toBeVisible();
        await commandPalette.getByPlaceholder('Type an action (e.g. Save All, Play, Reset Layout)').fill('browser parity report');
        await expect(commandPalette.getByRole('option', { name: 'Show Browser Parity Report' })).toBeVisible();
        await commandPalette.getByRole('option', { name: 'Show Browser Parity Report' }).click();

        await expect(commandPalette).toHaveCount(0);
        await callVisualSmokeHarness(page, 'selectDockPanel', 'console');
        const consolePanel = page.locator('[data-console-panel="true"]');
        await expect(consolePanel).toBeVisible();
        await expect(consolePanel).toContainText('Editor runtime: browser');
        await expect(consolePanel).toContainText('Export parity: matched=3, browser-limited=3, desktop-only=1');
        await expect(consolePanel).toContainText('projectFileSystem: desktop=supported');
        await expect(consolePanel).toContainText('looseOutput: desktop-only');
    });

    test('covers command palette update diagnostics without invoking updater install', async ({ page }) => {
        await callVisualSmokeHarness(page, 'openCommandPalette');
        const commandPalette = page.getByRole('dialog', { name: 'Command palette' });
        await expect(commandPalette).toBeVisible();
        await commandPalette.getByPlaceholder('Type an action (e.g. Save All, Play, Reset Layout)').fill('update diagnostics');
        await expect(commandPalette.getByRole('option', { name: 'Show Update Diagnostics' })).toBeVisible();
        await commandPalette.getByRole('option', { name: 'Show Update Diagnostics' }).click();

        await expect(commandPalette).toHaveCount(0);
        await callVisualSmokeHarness(page, 'selectDockPanel', 'console');
        const consolePanel = page.locator('[data-console-panel="true"]');
        await expect(consolePanel).toBeVisible();
        await expect(consolePanel).toContainText('Editor update diagnostics');
        await expect(consolePanel).toContainText('Runtime: browser');
        await expect(consolePanel).toContainText('Update checks: unavailable in browser runtime');
        await expect(consolePanel).toContainText('Updater endpoint: https://github.com/Zeffuro/Zerith/releases/latest/download/latest.json');
    });

    test('covers command palette Git integration report without opening a project', async ({ page }) => {
        await callVisualSmokeHarness(page, 'openCommandPalette');
        const commandPalette = page.getByRole('dialog', { name: 'Command palette' });
        await expect(commandPalette).toBeVisible();
        await commandPalette.getByPlaceholder('Type an action (e.g. Save All, Play, Reset Layout)').fill('git integration report');
        await expect(commandPalette.getByRole('option', { name: 'Show Git Integration Report' })).toBeVisible();
        await commandPalette.getByRole('option', { name: 'Show Git Integration Report' }).click();

        await expect(commandPalette).toHaveCount(0);
        await callVisualSmokeHarness(page, 'selectDockPanel', 'console');
        const consolePanel = page.locator('[data-console-panel="true"]');
        await expect(consolePanel).toBeVisible();
        await expect(consolePanel).toContainText('Editor runtime: browser');
        await expect(consolePanel).toContainText('Recommended: 0, limited: 0, deferred: 1, unsupported: 2');
        await expect(consolePanel).toContainText('Backend: Browser Git disabled');
        await expect(consolePanel).toContainText('backend/browserDisabled: selected');
        await expect(consolePanel).toContainText('browserWebGit: desktop=unsupported, browser=deferred');
    });

    test('covers scene editor hierarchy with a real project open', async ({ page }) => {
        const files = await readProjectFixture('games/classic-vn-starter');
        await callVisualSmokeHarness(page, 'openProjectFixture', {
            entryPath: 'scenes/intro.json',
            files,
            rootName: 'classic-vn-starter',
            selectedPath: [5],
        });
        await settleEditor(page);

        await expect(page.getByText('intro.json').first()).toBeVisible();
        await expect(page.getByText('Scene Composer')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Reveal in JSON' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-expanded', 'false');
        await expect(page.locator('[aria-label="Scene overview"]')).toHaveCount(0);

        await page.getByRole('button', { name: 'Overview' }).click();
        await expect(page.getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-expanded', 'true');
        await expect(page.locator('[aria-label="Scene overview"]')).toBeVisible();
        const graphStatus = page.getByLabel('Timeline graph status');
        await expect(graphStatus).toContainText('Graph canvas blocked');
        await expect(graphStatus).toContainText('Timeline overview graph');
        await expect(graphStatus).toContainText('Full graph canvas');

        await page.getByRole('button', { name: 'Reveal in JSON' }).click();
        await expect(page.getByText('Current: json')).toBeVisible();
        await expect(page.getByText('Script JSON mode')).toBeVisible();
    });

    test('covers asset organization with a real project open', async ({ page }) => {
        const files = await readProjectFixture('games/classic-vn-starter');
        await callVisualSmokeHarness(page, 'openProjectFixture', {
            entryPath: 'scenes/intro.json',
            files,
            rootName: 'classic-vn-starter',
            selectedPath: [5],
        });
        await callVisualSmokeHarness(page, 'selectDockPanel', 'asset_dependencies');
        await page.waitForTimeout(650);

        await expect(page.getByText('Asset Dependencies')).toBeVisible();
        await expect(page.getByRole('status').filter({ hasText: 'Used:' })).toBeVisible();

        const organizeVisible = page.getByRole('button', { name: /Organize visible assets \(\d+\)/u });
        await expect(organizeVisible).toBeEnabled();
        await organizeVisible.click();

        await expect(page.getByRole('dialog', { name: 'Organize Visible Assets' })).toBeVisible();
        await page.getByRole('button', { name: 'Cancel' }).click();
    });

    test('covers audio cue review with a real project open', async ({ page }) => {
        const files = await readProjectFixture('games/example-game');
        await callVisualSmokeHarness(page, 'openProjectFixture', {
            entryPath: 'scenes/intro.json',
            files,
            rootName: 'example-game',
            selectedPath: [0],
        });
        await callVisualSmokeHarness(page, 'selectDockPanel', 'asset_dependencies');

        const cueReview = page.locator('section').filter({ hasText: 'Audio cue review' });
        await expect(cueReview).toBeVisible();
        await expect(cueReview.getByRole('status').filter({ hasText: '1/1 sheet | 3 cues' })).toBeVisible();
        const exportStatus = cueReview.getByLabel('Audio cue export status');
        await expect(exportStatus).toContainText('Export status: Ready');
        await expect(exportStatus).toContainText('3 cue WAVs ready from 1 sheet.');
        await expect(cueReview).toContainText('/assets/sfx/voices.sheet.json');
        await expect(cueReview).toContainText('Source: /assets/sfx/voices.wav');
        await expect(cueReview.getByRole('button', { name: 'Organize Cue Assets (2)' })).toBeEnabled();
        await expect(cueReview.getByRole('button', { name: 'Open Sheet' })).toBeVisible();
        await expect(cueReview.getByRole('button', { name: 'Open Source', exact: true })).toBeEnabled();

        await cueReview.getByLabel('Search audio cue review').fill('holdit');
        await expect(cueReview.getByRole('status').filter({ hasText: '1/1 sheet | 3 cues' })).toBeVisible();
        await expect(cueReview).toContainText('holdit');
    });

    test('covers audio cue review missing-source status with a real project open', async ({ page }) => {
        const files = await readProjectFixture('games/example-game');
        delete files['assets/sfx/voices.wav'];

        await callVisualSmokeHarness(page, 'openProjectFixture', {
            entryPath: 'scenes/intro.json',
            files,
            rootName: 'example-game-missing-audio',
            selectedPath: [0],
        });
        await callVisualSmokeHarness(page, 'selectDockPanel', 'asset_dependencies');

        const cueReview = page.locator('section').filter({ hasText: 'Audio cue review' });
        await expect(cueReview).toBeVisible();
        const exportStatus = cueReview.getByLabel('Audio cue export status');
        await expect(exportStatus).toContainText('Export status: Blocked');
        await expect(exportStatus).toContainText('1 visible sheet missing source audio.');
        await expect(cueReview).toContainText('Source audio missing: /assets/sfx/voices.wav');
        await expect(cueReview.getByRole('button', { name: 'Export Visible' })).toBeDisabled();
        await expect(cueReview.getByRole('button', { name: 'Export', exact: true })).toBeDisabled();
        await expect(cueReview.getByRole('button', { name: 'Open Source', exact: true })).toBeDisabled();

        await cueReview.getByRole('button', { name: 'Missing source 1' }).click();
        await expect(cueReview.getByRole('status').filter({ hasText: '1/1 sheet | 3 cues' })).toBeVisible();
    });

    test('covers audio cue review sheet routing with a real project open', async ({ page }) => {
        const files = await readProjectFixture('games/example-game');
        await callVisualSmokeHarness(page, 'openProjectFixture', {
            entryPath: 'scenes/intro.json',
            files,
            rootName: 'example-game',
            selectedPath: [0],
        });
        await callVisualSmokeHarness(page, 'selectDockPanel', 'asset_dependencies');

        const cueReview = page.locator('section').filter({ hasText: 'Audio cue review' });
        await expect(cueReview).toBeVisible();
        await expect(cueReview).toContainText('/assets/sfx/voices.sheet.json');
        await cueReview.getByRole('button', { name: 'Open Sheet' }).click();

        await expect(page.getByText('voices.sheet.json').first()).toBeVisible();
        await expect(page.getByText('Audiosheet Editor')).toBeVisible();
        await expect(page.locator('input[value="objection"]')).toBeVisible();
        await expect(page.locator('input[value="holdit"]')).toBeVisible();
        await expect(page.locator('input[value="takethat"]')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Save All Cues' })).toBeDisabled();
    });

    test('covers audio cue review source routing with a real project open', async ({ page }) => {
        const files = await readProjectFixture('games/example-game');
        await callVisualSmokeHarness(page, 'openProjectFixture', {
            entryPath: 'scenes/intro.json',
            files,
            rootName: 'example-game',
            selectedPath: [0],
        });
        await callVisualSmokeHarness(page, 'selectDockPanel', 'asset_dependencies');

        const cueReview = page.locator('section').filter({ hasText: 'Audio cue review' });
        await expect(cueReview).toBeVisible();
        await expect(cueReview).toContainText('Source: /assets/sfx/voices.wav');
        await cueReview.getByRole('button', { name: 'Open Source', exact: true }).click();

        await expect(page.getByText('voices.wav').first()).toBeVisible();
        await expect(page.getByText('Asset Preview')).toBeVisible();
        await expect(page.locator('input[value="/assets/sfx/voices.wav"]')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Save to Project' })).toBeDisabled();
    });

    test('covers audio cue organization dialog with a real project open', async ({ page }) => {
        const files = await readProjectFixture('games/example-game');
        await callVisualSmokeHarness(page, 'openProjectFixture', {
            entryPath: 'scenes/intro.json',
            files,
            rootName: 'example-game',
            selectedPath: [0],
        });
        await callVisualSmokeHarness(page, 'selectDockPanel', 'asset_dependencies');

        const cueReview = page.locator('section').filter({ hasText: 'Audio cue review' });
        await expect(cueReview).toBeVisible();
        await cueReview.getByRole('button', { name: 'Organize Cue Assets (2)' }).click();

        const dialog = page.getByRole('dialog', { name: 'Organize Visible Cue Assets' });
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText('2 cue-linked assets');
        await expect(dialog.getByLabel('Collections')).toBeVisible();
        await expect(dialog.getByLabel('Tags')).toBeVisible();
        await expect(dialog.getByRole('button', { name: 'Apply labels' })).toBeVisible();
        await dialog.getByRole('button', { name: 'Cancel' }).click();
        await expect(dialog).toHaveCount(0);
    });

    test('covers Git browser fallback with a real project open', async ({ page }) => {
        const files = await readProjectFixture('games/classic-vn-starter');
        await callVisualSmokeHarness(page, 'openProjectFixture', {
            entryPath: 'scenes/intro.json',
            files,
            rootName: 'classic-vn-starter',
            selectedPath: [0],
        });
        await callVisualSmokeHarness(page, 'selectDockPanel', 'git');

        const gitPanel = page.locator('.zerith-scrollbar').filter({ hasText: 'Backend Strategy' });
        await expect(gitPanel).toBeVisible();
        await expect(gitPanel).toContainText('Git status is disabled in browser builds until repository access and project-handle persistence are designed.');
        await expect(gitPanel).toContainText('Branch');
        await expect(gitPanel).toContainText('Unavailable');
        await expect(gitPanel.getByRole('button', { name: 'Init Repo' })).toBeDisabled();
        await expect(gitPanel.getByRole('button', { name: 'Branch' })).toBeDisabled();
        await expect(gitPanel).toContainText('Browser Git disabled');
        await expect(gitPanel).toContainText('Keep browser Git disabled or read-only until repository access policy is designed.');
    });

    test('covers command palette Git status report browser fallback with a real project open', async ({ page }) => {
        const files = await readProjectFixture('games/classic-vn-starter');
        await callVisualSmokeHarness(page, 'openProjectFixture', {
            entryPath: 'scenes/intro.json',
            files,
            rootName: 'classic-vn-starter',
            selectedPath: [0],
        });

        await callVisualSmokeHarness(page, 'openCommandPalette');
        const commandPalette = page.getByRole('dialog', { name: 'Command palette' });
        await expect(commandPalette).toBeVisible();
        await commandPalette.getByPlaceholder('Type an action (e.g. Save All, Play, Reset Layout)').fill('git status report');
        await expect(commandPalette.getByRole('option', { name: 'Show Git Status Report' })).toBeVisible();
        await commandPalette.getByRole('option', { name: 'Show Git Status Report' }).click();

        await expect(commandPalette).toHaveCount(0);
        await callVisualSmokeHarness(page, 'selectDockPanel', 'console');
        const consolePanel = page.locator('[data-console-panel="true"]');
        await expect(consolePanel).toBeVisible();
        await expect(consolePanel).toContainText('Git status is disabled in browser builds until repository access and project-handle persistence are designed.');
    });

    test('covers command palette routing with a real project open', async ({ page }) => {
        const files = await readProjectFixture('games/classic-vn-starter');
        await callVisualSmokeHarness(page, 'openProjectFixture', {
            entryPath: 'scenes/intro.json',
            files,
            rootName: 'classic-vn-starter',
            selectedPath: [0],
        });

        await callVisualSmokeHarness(page, 'openCommandPalette');
        const commandPalette = page.getByRole('dialog', { name: 'Command palette' });
        await expect(commandPalette).toBeVisible();
        await commandPalette.getByPlaceholder('Type an action (e.g. Save All, Play, Reset Layout)').fill('export game');
        await expect(commandPalette.getByRole('option', { name: /Export Game/u })).toBeVisible();
        await commandPalette.getByRole('option', { name: /Export Game/u }).click();

        await expect(commandPalette).toHaveCount(0);
        await expect(page.getByRole('dialog', { name: 'Export Game' })).toBeVisible();
        await expect(page.getByRole('status').filter({ hasText: 'Project: /classic-vn-starter' })).toBeVisible();
        await expect(page.getByLabel(/Output Directory/u)).toHaveValue('dist/classic-vn-starter');
        await expect(page.getByRole('button', { name: 'Export' })).toBeEnabled();
    });

    test('covers command palette validation reporting with a real project open', async ({ page }) => {
        const files = await readProjectFixture('games/classic-vn-starter');
        await callVisualSmokeHarness(page, 'openProjectFixture', {
            entryPath: 'scenes/intro.json',
            files,
            rootName: 'classic-vn-starter',
            selectedPath: [0],
        });

        await callVisualSmokeHarness(page, 'openCommandPalette');
        const commandPalette = page.getByRole('dialog', { name: 'Command palette' });
        await expect(commandPalette).toBeVisible();
        await commandPalette.getByPlaceholder('Type an action (e.g. Save All, Play, Reset Layout)').fill('validate project');
        await expect(commandPalette.getByRole('option', { name: /Validate Project Content/u })).toBeVisible();
        await commandPalette.getByRole('option', { name: /Validate Project Content/u }).click();

        await expect(commandPalette).toHaveCount(0);
        await callVisualSmokeHarness(page, 'selectDockPanel', 'console');
        const consolePanel = page.locator('[data-console-panel="true"]');
        await expect(consolePanel).toBeVisible();
        await expect(consolePanel).toContainText('Project validation: clean');
        await expect(consolePanel).toContainText('Scenes: 3; graph issues: 0');
        await expect(consolePanel).toContainText('Localization: 19 references; missing: 0');
    });

    test('covers command palette migration reporting with a real project open', async ({ page }) => {
        const files = await readProjectFixture('games/classic-vn-starter');
        await callVisualSmokeHarness(page, 'openProjectFixture', {
            entryPath: 'scenes/intro.json',
            files,
            rootName: 'classic-vn-starter',
            selectedPath: [0],
        });

        await callVisualSmokeHarness(page, 'openCommandPalette');
        const commandPalette = page.getByRole('dialog', { name: 'Command palette' });
        await expect(commandPalette).toBeVisible();
        await commandPalette.getByPlaceholder('Type an action (e.g. Save All, Play, Reset Layout)').fill('migrate content');
        await expect(commandPalette.getByRole('option', { name: /Migrate Content Schema/u })).toBeVisible();
        await commandPalette.getByRole('option', { name: /Migrate Content Schema/u }).click();

        const migrationDialog = page.getByRole('dialog', { name: 'Migrate Content Schema' });
        await expect(migrationDialog).toBeVisible();
        await expect(migrationDialog).toContainText('Migrate 3 content file(s) to the current schema?');
        await expect(migrationDialog).toContainText('/classic-vn-starter/scenes/chapter_one.json');
        await expect(migrationDialog).toContainText('/classic-vn-starter/scenes/ending.json');
        await expect(migrationDialog).toContainText('/classic-vn-starter/scenes/intro.json');
        await migrationDialog.getByRole('button', { name: 'Skip' }).click();

        await expect(commandPalette).toHaveCount(0);
        await expect(migrationDialog).toHaveCount(0);
        await expect(page.getByRole('status').filter({ hasText: 'Content migration cancelled.' })).toBeVisible();
        await expect(page.getByText('Scene Composer')).toBeVisible();
    });

    test('covers command palette localization routing with a real project open', async ({ page }) => {
        const files = await readProjectFixture('games/classic-vn-starter');
        await callVisualSmokeHarness(page, 'openProjectFixture', {
            entryPath: 'scenes/intro.json',
            files,
            rootName: 'classic-vn-starter',
            selectedPath: [0],
        });

        await callVisualSmokeHarness(page, 'openCommandPalette');
        const commandPalette = page.getByRole('dialog', { name: 'Command palette' });
        await expect(commandPalette).toBeVisible();
        await commandPalette.getByPlaceholder('Type an action (e.g. Save All, Play, Reset Layout)').fill('open localization');
        await expect(commandPalette.getByRole('option', { name: 'Open Localization' })).toBeVisible();
        await commandPalette.getByRole('option', { name: 'Open Localization' }).click();

        await expect(commandPalette).toHaveCount(0);
        await expect(page.getByText('Localization').first()).toBeVisible();
        await expect(page.getByRole('button', { name: 'Use in Preview' })).toBeVisible();
        await expect(page.getByText('intro.opening.001')).toBeVisible();
    });

    test('covers command palette global search routing with a real project open', async ({ page }) => {
        const files = await readProjectFixture('games/classic-vn-starter');
        await callVisualSmokeHarness(page, 'openProjectFixture', {
            entryPath: 'scenes/intro.json',
            files,
            rootName: 'classic-vn-starter',
            selectedPath: [0],
        });

        await callVisualSmokeHarness(page, 'openCommandPalette');
        const commandPalette = page.getByRole('dialog', { name: 'Command palette' });
        await expect(commandPalette).toBeVisible();
        await commandPalette.getByPlaceholder('Type an action (e.g. Save All, Play, Reset Layout)').fill('find in project');
        await expect(commandPalette.getByRole('option', { name: 'Find in Project' })).toBeVisible();
        await commandPalette.getByRole('option', { name: 'Find in Project' }).click();

        await expect(commandPalette).toHaveCount(0);
        const searchPopup = page
            .locator('.zerith-scrollbar')
            .filter({ has: page.getByPlaceholder('Search scenes, macros, characters, items...') })
            .filter({ hasText: 'Find in Project' });
        await expect(searchPopup).toBeVisible();
        await searchPopup.getByPlaceholder('Search scenes, macros, characters, items...').fill('Every classic visual novel');
        await expect(searchPopup).toContainText('1 result(s)');
        await expect(searchPopup).toContainText('Replaceable hits: 1');
        await expect(searchPopup.getByRole('button', { name: /Every classic visual novel/u })).toBeVisible();
    });

    test('covers command palette find and replace routing with a real project open', async ({ page }) => {
        const files = await readProjectFixture('games/classic-vn-starter');
        await callVisualSmokeHarness(page, 'openProjectFixture', {
            entryPath: 'scenes/intro.json',
            files,
            rootName: 'classic-vn-starter',
            selectedPath: [0],
        });

        await callVisualSmokeHarness(page, 'openCommandPalette');
        const commandPalette = page.getByRole('dialog', { name: 'Command palette' });
        await expect(commandPalette).toBeVisible();
        await commandPalette.getByPlaceholder('Type an action (e.g. Save All, Play, Reset Layout)').fill('find and replace');
        await expect(commandPalette.getByRole('option', { name: 'Find and Replace in Project' })).toBeVisible();
        await commandPalette.getByRole('option', { name: 'Find and Replace in Project' }).click();

        await expect(commandPalette).toHaveCount(0);
        const replacePopup = page
            .locator('.zerith-scrollbar')
            .filter({ has: page.getByPlaceholder('Replace text...') })
            .filter({ hasText: 'Find and Replace in Project' });
        await expect(replacePopup).toBeVisible();
        await expect(replacePopup.getByPlaceholder('Replace text...')).toBeFocused();
        await replacePopup.getByPlaceholder('Search scenes, macros, characters, items...').fill('Every classic visual novel');
        await replacePopup.getByPlaceholder('Replace text...').fill('Every focused visual novel');
        await expect(replacePopup).toContainText('1 result(s)');
        await expect(replacePopup).toContainText('Preview replacements: 1');
        await expect(replacePopup.getByRole('button', { name: 'Replace', exact: true })).toBeEnabled();
        await expect(replacePopup.getByRole('button', { name: 'Replace All' })).toBeEnabled();
    });

    test('covers validation and localization source jumps with a real project open', async ({ page }) => {
        const files = await readProjectFixture('games/classic-vn-starter');
        await callVisualSmokeHarness(page, 'openProjectFixture', {
            entryPath: 'scenes/intro.json',
            files,
            rootName: 'classic-vn-starter',
            selectedPath: [0],
        });

        await callVisualSmokeHarness(page, 'selectDockPanel', 'project_validation');
        await page.getByRole('button', { name: 'Validate' }).click();
        await expect(page.getByRole('status').filter({ hasText: 'Validation complete. No issues found.' })).toBeVisible();
        await expect(page.getByText('No validation issues found.')).toBeVisible();

        await callVisualSmokeHarness(page, 'openLocalizationWorkbench');
        await expect(page.getByText('Localization').first()).toBeVisible();
        await expect(page.getByRole('button', { name: 'Use in Preview' })).toBeVisible();
        await expect(page.getByText('intro.opening.001')).toBeVisible();

        await page.getByPlaceholder('Filter line IDs or text...').fill('intro.opening.001');
        await expect(page.getByText('Every classic visual novel starts with a room, a choice, and a promise.').first()).toBeVisible();

        await page.getByRole('button', { name: /intro @ 5/u }).click();
        await expect(page.getByText('Scene Composer')).toBeVisible();
        await expect(page.getByText('At command 6 of 17')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Reveal in JSON' })).toBeVisible();
    });

    test('covers validation missing-locale repair routing with a real project open', async ({ page }) => {
        const files = removeLocaleEntryFromFixture(
            await readProjectFixture('games/classic-vn-starter'),
            'scene.intro',
            'intro.opening.001',
        );
        await callVisualSmokeHarness(page, 'openProjectFixture', {
            entryPath: 'scenes/intro.json',
            files,
            rootName: 'classic-vn-starter',
            selectedPath: [0],
        });

        await callVisualSmokeHarness(page, 'selectDockPanel', 'project_validation');
        await page.getByRole('button', { name: 'Validate' }).click();

        await expect(page.getByRole('status').filter({ hasText: 'Validation complete. 1 issue row found.' })).toBeVisible();
        await expect(page.getByText('Missing en text: scene.intro:intro.opening.001')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Source' })).toBeVisible();
        await page.getByRole('button', { name: 'Locale' }).click();

        await expect(page.getByText('Localization').first()).toBeVisible();
        await expect(page.getByLabel('Localization row status filter')).toHaveValue('missing');
        await expect(page.getByLabel('Localization namespace filter')).toHaveValue('scene.intro');
        await expect(page.getByPlaceholder('Filter line IDs or text...')).toHaveValue('scene.intro:intro.opening.001');
        await expect(page.getByText('Missing locale entry')).toBeVisible();
        const localeDraft = page.locator('textarea').first();
        await expect(localeDraft).toHaveValue('');

        await page.getByRole('button', { name: 'Fill Missing (1)' }).click();
        await expect(page.getByText('Prepared 1 missing locale entry from source text.')).toBeVisible();
        await expect(localeDraft).toHaveValue('Every classic visual novel starts with a room, a choice, and a promise.');
        await expect(page.getByRole('button', { name: 'Save Locale' })).toBeEnabled();
    });

    test('covers timeline graph missing-scene repair with a real project open', async ({ page }) => {
        const files = replaceIntroJumpTargetInFixture(
            await readProjectFixture('games/classic-vn-starter'),
            'bonus_scene',
        );
        await callVisualSmokeHarness(page, 'openProjectFixture', {
            entryPath: 'scenes/intro.json',
            files,
            rootName: 'classic-vn-starter',
            selectedPath: [16],
        });

        await expect(page.getByText('Scene Composer')).toBeVisible();
        await expect(page.getByText('At command 17 of 17')).toBeVisible();
        await page.getByRole('button', { name: 'Overview' }).click();
        const sceneOverview = page.locator('[aria-label="Scene overview"]');
        await expect(sceneOverview).toBeVisible();

        const createSceneButton = page.getByRole('button', { name: 'Create scene bonus_scene' });
        await expect(createSceneButton).toBeVisible();
        await createSceneButton.click();

        await expect(page.getByText('bonus_scene.json').first()).toBeVisible();
        await expect(page.getByText(/Full scene - 2 commands/u)).toBeVisible();
        await expect(sceneOverview).toContainText('1 lines');
        await expect(page.getByText(/Graph: bonus_scene/u)).toBeVisible();
    });

    test('covers export defaults with a real project open', async ({ page }) => {
        const files = await readProjectFixture('games/classic-vn-starter');
        await callVisualSmokeHarness(page, 'openProjectFixture', {
            entryPath: 'scenes/intro.json',
            files,
            rootName: 'classic-vn-starter',
            selectedPath: [5],
        });

        await callVisualSmokeHarness(page, 'openExportGameModal');
        await expect(page.getByRole('dialog', { name: 'Export Game' })).toBeVisible();
        await expect(page.getByRole('status').filter({ hasText: 'Project: /classic-vn-starter' })).toBeVisible();
        await expect(page.getByLabel(/Output Directory/u)).toHaveValue('dist/classic-vn-starter');
        await expect(page.getByLabel('Zip Output Path')).toHaveValue('dist/classic-vn-starter.zip');
        const desktopStatus = page.getByLabel('Desktop packaging status');
        await expect(desktopStatus).toContainText('Desktop package blocked');
        await expect(desktopStatus).toContainText('Export artifact contract');
        await expect(desktopStatus).toContainText('Scoped game permissions');
        const pagesStatus = page.getByLabel('GitHub Pages dual-site status');
        await expect(pagesStatus).toContainText('Pages dual site ready');
        await expect(pagesStatus).toContainText('Playable deploy gate');
        await expect(pagesStatus).toContainText('Browser editor persistence');
        await expect(page.getByRole('button', { name: 'Export' })).toBeEnabled();
        await expect(page.getByRole('button', { name: 'Parity Smoke' })).toBeDisabled();
    });

    test('covers global search source jumps with a real project open', async ({ page }) => {
        const files = await readProjectFixture('games/classic-vn-starter');
        await callVisualSmokeHarness(page, 'openProjectFixture', {
            entryPath: 'scenes/intro.json',
            files,
            rootName: 'classic-vn-starter',
            selectedPath: [0],
        });

        await callVisualSmokeHarness(page, 'selectDockPanel', 'global_search');
        await page.getByPlaceholder('Search scenes, macros, characters, items...').fill('Every classic visual novel');

        await expect(page.getByText('1 result(s)')).toBeVisible();
        await expect(page.getByText('Replaceable hits: 1')).toBeVisible();

        await page.getByRole('button', { name: /Every classic visual novel/u }).click();
        await expect(page.getByText('Scene Composer')).toBeVisible();
        await expect(page.getByText('At command 6 of 17')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Reveal in JSON' })).toBeVisible();
    });

    test('covers reference tracker source jumps with a real project open', async ({ page }) => {
        const files = await readProjectFixture('games/classic-vn-starter');
        await callVisualSmokeHarness(page, 'openProjectFixture', {
            entryPath: 'scenes/intro.json',
            files,
            rootName: 'classic-vn-starter',
            selectedPath: [0],
        });

        await callVisualSmokeHarness(page, 'selectDockPanel', 'reference_tracker');
        await expect(page.getByText('Reference Tracker')).toBeVisible();
        await expect(page.getByRole('button', { name: /Characters \([1-9]\d*\)/u })).toBeVisible();

        await page.getByPlaceholder('Filter variables, items, characters...').fill('aria');
        await expect(page.getByRole('button', { name: 'Characters (1)' })).toBeVisible();

        await page.getByRole('button', { name: /aria references:/u }).click();
        const introDialogueReference = page
            .locator('button')
            .filter({ hasText: 'intro' })
            .filter({ hasText: 'dialogue' })
            .filter({ hasText: 'Path: 5' })
            .first();
        await expect(introDialogueReference).toBeVisible();
        await introDialogueReference.click();

        await expect(page.getByText('Scene Composer')).toBeVisible();
        await expect(page.getByText('At command 6 of 17')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Reveal in JSON' })).toBeVisible();
    });

    test('covers runtime monitor playback with a real project open', async ({ page }) => {
        const files = await readProjectFixture('games/classic-vn-starter');
        await callVisualSmokeHarness(page, 'openProjectFixture', {
            entryPath: 'scenes/intro.json',
            files,
            rootName: 'classic-vn-starter',
            selectedPath: [5],
        });

        await callVisualSmokeHarness(page, 'playPreviewFrom', 5);
        await callVisualSmokeHarness(page, 'selectDockPanel', 'runtime_monitor');

        const playbackSection = page.locator('section').filter({ hasText: 'Playback' }).first();
        await expect(playbackSection).toBeVisible();
        await expect(playbackSection).toContainText('preview @ 6/17');
        await expect(playbackSection).toContainText('aria: Every classic visual novel starts with a room, a choice, and a promise.');

        await callVisualSmokeHarness(page, 'stopPreview');
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
        async ([actionName, actionArguments]) => {
            const harness = window.__ZERITH_EDITOR_VISUAL_SMOKE__;
            await harness?.[actionName]?.(...actionArguments);
        },
        [action, args],
    );
}

async function readProjectFixture(relativeProjectPath) {
    const root = path.join(repoRoot(), relativeProjectPath);
    const files = {};
    await readFixtureFiles(root, root, files);
    return files;
}

async function readFixtureFiles(root, directory, files) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
        const absolutePath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            await readFixtureFiles(root, absolutePath, files);
            continue;
        }
        if (!entry.isFile()) continue;

        const relativePath = path.relative(root, absolutePath).replaceAll(path.sep, '/');
        files[relativePath] = shouldReadFixtureText(entry.name)
            ? await readFile(absolutePath, 'utf8')
            : '';
    }
}

function shouldReadFixtureText(fileName) {
    return ['.json', '.svg'].includes(path.extname(fileName).toLowerCase());
}

function repoRoot() {
    return fileURLToPath(new URL('../../../', import.meta.url));
}

function removeLocaleEntryFromFixture(files, namespace, lineId) {
    const nextFiles = { ...files };
    const bundle = JSON.parse(nextFiles['locales/en.json']);
    delete bundle.namespaces?.[namespace]?.[lineId];
    nextFiles['locales/en.json'] = JSON.stringify(bundle, undefined, 4);
    return nextFiles;
}

function replaceIntroJumpTargetInFixture(files, targetScene) {
    const nextFiles = { ...files };
    const intro = JSON.parse(nextFiles['scenes/intro.json']);
    const jump = intro.commands.find((command) => command?.type === 'jump');
    if (!jump) throw new Error('classic-vn-starter intro fixture is missing a jump command.');
    jump.to = targetScene;
    nextFiles['scenes/intro.json'] = JSON.stringify(intro, undefined, 4);
    return nextFiles;
}

async function settleEditor(page) {
    await page.evaluate(async () => {
        await document.fonts?.ready;
    });
    await page.waitForTimeout(150);
}

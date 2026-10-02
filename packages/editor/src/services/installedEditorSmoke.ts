import { invoke } from '@tauri-apps/api/core';

import type { BrowserDesktopExportArtifactManifest } from './browserParityReport';

import { useProjectStore } from '../store/storeBootstrap';
import { makeTabId, useWorkbenchStore } from '../store/useWorkbenchStore';
import { normalizePathForComparison } from '../utils/pathComparison';
import { createNewProject } from './createNewProject';
import { exportGame } from './exportGame';
import { fsJoin, fsReadTextFile } from './fs';

export type InstalledSmokeConfig = {
    existingProjectPath?: string;
    outDir: string;
    parentPath: string;
    projectName: string;
    zipFile: string;
};

export type InstalledSmokeResult = {
    artifactManifest?: BrowserDesktopExportArtifactManifest;
    editedTitle?: string;
    error?: string;
    manifestPath?: string;
    outDirectory?: string;
    projectPath?: string;
    status: 'failed' | 'passed';
    steps: string[];
    zipPath?: string;
};

export async function runInstalledEditorSmoke(config: InstalledSmokeConfig): Promise<void> {
    const result: InstalledSmokeResult = { status: 'failed', steps: [] };
    try {
        const projectPath = config.existingProjectPath ?? await fsJoin(config.parentPath, config.projectName);
        const manifestPath = await fsJoin(projectPath, 'game.json');
        result.projectPath = projectPath;
        result.manifestPath = manifestPath;
        if (!config.existingProjectPath) {
            await createNewProject({ author: 'Installed smoke', directory: projectPath, name: config.projectName, templateId: 'classic-vn' });
            result.steps.push('create');
        }
        await useProjectStore.getState().openProjectFromManifest(manifestPath);
        assertProjectLoaded(projectPath);
        result.steps.push('open');

        const title = `${config.projectName} — saved and reopened`;
        const originalText = await fsReadTextFile(manifestPath);
        const manifest = JSON.parse(originalText) as Record<string, unknown>;
        const edited = `${JSON.stringify({ ...manifest, title }, undefined, 4)}\n`;
        const tabId = makeTabId('manifest', manifestPath);
        useWorkbenchStore.getState().openOrFocusTab({ id: tabId, kind: 'manifest', path: manifestPath, textContent: originalText, title: 'game.json' });
        useWorkbenchStore.getState().updateTabContent(tabId, edited);
        useProjectStore.getState().markFileDirty(manifestPath);
        result.steps.push('edit');
        const saved = await useProjectStore.getState().saveAllDirtyFiles();
        if (saved.failed.length > 0 || saved.skipped.length > 0 || !saved.saved.includes(manifestPath)) {
            throw new Error(`Save did not complete: ${JSON.stringify(saved)}`);
        }
        result.steps.push('save');
        useProjectStore.getState().setProject(undefined, []);
        useWorkbenchStore.getState().clearTabs();
        await useProjectStore.getState().openProjectFromManifest(manifestPath);
        assertProjectLoaded(projectPath);
        if (useProjectStore.getState().manifest?.title !== title || (JSON.parse(await fsReadTextFile(manifestPath)) as Record<string, unknown>).title !== title) {
            throw new Error('Reopened project did not contain the saved edit.');
        }
        result.editedTitle = title;
        result.steps.push('reopen');
        const options = { outDir: config.outDir, zip: true, zipFile: config.zipFile };
        const exported = await exportGame(projectPath, options);
        if (!exported.outDirectory || !exported.zipPath || !exported.artifactManifest) {
            throw new Error('Native export did not return complete output paths and artifact manifest.');
        }
        result.outDirectory = exported.outDirectory;
        result.zipPath = exported.zipPath;
        result.artifactManifest = exported.artifactManifest;
        result.steps.push('export');
        let overwriteRejected = false;
        try {
            await exportGame(projectPath, options);
        } catch (error) {
            overwriteRejected = String(error).includes('already exists');
        }
        if (!overwriteRejected) throw new Error('Existing export output was not rejected.');
        result.steps.push('overwrite-guard');
        result.status = 'passed';
    } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
    }
    await invoke('installed_smoke_complete', { result });
}

function assertProjectLoaded(projectPath: string): void {
    const current = useProjectStore.getState();
    if (!current.projectPath || normalizePathForComparison(current.projectPath) !== normalizePathForComparison(projectPath) || !current.manifest) {
        throw new Error('Project did not load into the editor store.');
    }
}

import type { Command } from '@zeffuro/zerith-core';

import type { MacroEntry } from '../project/types';

import { executeContentMigrationCommand } from '../../services/contentMigrationCommand';
import { chooseProjectOpenTarget, confirmEditorAction } from '../../services/editorDialogs';
import { isTauriRuntime } from '../../services/runtime/runtimeEnvironment';
import { openProjectInNewEditorWindow } from '../../services/runtime/windowControls';
import { useProjectStore, useScriptStore } from '../storeBootstrap';
import { useEditorStore } from '../useEditorStore';
import { useWorkbenchStore } from '../useWorkbenchStore';

export type ExecuteProjectOpenActionOptions =
    | { action: 'applyAssetSelection'; assetPath: string }
    | { action: 'applyMacrosFile'; entries: MacroEntry[]; path: string; }
    | { action: 'applyScriptFile'; path: string; script: Command[] };

export type OpenProjectInCurrentWindowOptions = {
    allowNewWindow?: boolean;
    checkMigration?: boolean;
    prompt?: boolean;
};

export type ProjectOpenResult =
    | { status: 'cancelled' }
    | { status: 'opened-current' }
    | { status: 'opened-new-window' };


export function closeProject(): void {
    useWorkbenchStore.getState().clearTabs();
    useProjectStore.getState().setProject(undefined, []);
    useScriptStore.getState().setScript([]);
}

export function executeCloseProjectAction(): void {
    const dirtyCount = useProjectStore.getState().dirtyFiles.size;
    if (dirtyCount > 0) {
        useEditorStore.getState().requestProjectClose();
        return;
    }

    closeProject();
}

export async function executeOpenProjectInCurrentWindow(
    manifestPath: string,
    options: OpenProjectInCurrentWindowOptions = {},
): Promise<ProjectOpenResult> {
    const project = useProjectStore.getState();
    const currentProjectPath = project.projectPath;
    const nextProjectPath = projectRootFromManifestPath(manifestPath);
    const switchingProject = Boolean(
        currentProjectPath
        && normalizeProjectPath(currentProjectPath) !== normalizeProjectPath(nextProjectPath),
    );

    const openTarget = await resolveProjectOpenTarget({
        currentProjectPath,
        nextProjectPath,
        options,
        switchingProject,
    });

    if (openTarget === 'cancelled') return { status: 'cancelled' };

    if (openTarget === 'new-window') {
        try {
            await openProjectInNewEditorWindow(manifestPath);
            return { status: 'opened-new-window' };
        } catch (error) {
            console.error('Failed to open project in a new editor window:', error);
            globalThis.alert?.(`Failed to open project in a new editor window: ${formatError(error)}`);
            return { status: 'cancelled' };
        }
    }

    if (switchingProject && useProjectStore.getState().dirtyFiles.size > 0) {
        useEditorStore.getState().markManualSave();
        const saveResult = await useProjectStore.getState().saveAllDirtyFiles();
        const remainingDirtyCount = useProjectStore.getState().dirtyFiles.size;

        if (saveResult.failed.length > 0 || remainingDirtyCount > 0) {
            const alertMessage = [
                'Project switch cancelled because not all dirty files could be saved.',
                '',
                saveResult.failed.length > 0
                    ? `Failed: ${saveResult.failed.join(', ')}`
                    : undefined,
            ].filter(Boolean).join('\n');
            globalThis.alert?.(alertMessage);
            return { status: 'cancelled' };
        }
    }

    if (options.checkMigration !== false) {
        await checkProjectContentMigration(nextProjectPath);
    }

    if (switchingProject) {
        useWorkbenchStore.getState().clearTabs();
    }

    await useProjectStore.getState().openProjectFromManifest(manifestPath);
    return { status: 'opened-current' };
}

export function executeProjectOpenAction(options: ExecuteProjectOpenActionOptions): void {
    if (options.action === 'applyAssetSelection') {
        useEditorStore.getState().setSelectedAssetPath(options.assetPath);
        return;
    }

    const project = useProjectStore.getState();

    if (options.action === 'applyScriptFile') {
        project.setActiveFile(options.path, options.script);
        project.setActiveMacroName(undefined);
        project.setEditingAllMacrosFile(false);
        project.setMacroEntries([]);
        return;
    }

    project.setActiveMacroName(undefined);
    project.setEditingAllMacrosFile(true);
    project.setMacroEntries(options.entries);
    project.setActiveFile(options.path, []);
}

async function checkProjectContentMigration(projectPath: string): Promise<void> {
    try {
        await executeContentMigrationCommand(projectPath);
    } catch (error) {
        console.error('Project migration check failed:', error);
        globalThis.alert?.(`Project migration check failed. Opening will continue.\n\n${formatError(error)}`);
    }
}

async function confirmProjectSwitch(dirtyCount: number): Promise<boolean> {
    const dirtyLine = dirtyCount > 0
        ? `${dirtyCount} unsaved file${dirtyCount === 1 ? '' : 's'} will be saved first.`
        : undefined;

    return confirmEditorAction({
        cancelText: 'Cancel',
        confirmText: 'Open Here',
        message: [
            'Open this project in the current editor window?',
            '',
            'Existing tabs will close.',
            dirtyLine,
        ].filter(Boolean).join('\n'),
        title: 'Open Project',
    });
}

function formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function normalizeProjectPath(path: string): string {
    return path.replaceAll('\\', '/').replace(/\/+$/u, '').toLowerCase();
}

function projectRootFromManifestPath(manifestPath: string): string {
    const normalized = manifestPath.replaceAll('\\', '/');
    const lastSlashIndex = normalized.lastIndexOf('/');

    if (lastSlashIndex === -1) {
        return '';
    }

    return normalized.slice(0, lastSlashIndex);
}

async function resolveProjectOpenTarget({
    currentProjectPath,
    nextProjectPath,
    options,
    switchingProject,
}: {
    currentProjectPath: string | undefined;
    nextProjectPath: string;
    options: OpenProjectInCurrentWindowOptions;
    switchingProject: boolean;
}): Promise<'cancelled' | 'current' | 'new-window'> {
    if (!switchingProject || options.prompt === false) return 'current';

    if (options.allowNewWindow !== false && isTauriRuntime()) {
        const choice = await chooseProjectOpenTarget({
            currentProjectPath,
            dirtyCount: useProjectStore.getState().dirtyFiles.size,
            nextProjectPath,
        });

        if (choice === 'cancel') return 'cancelled';
        return choice;
    }

    return (await confirmProjectSwitch(useProjectStore.getState().dirtyFiles.size))
        ? 'current'
        : 'cancelled';
}


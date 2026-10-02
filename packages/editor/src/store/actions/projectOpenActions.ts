import type { Command } from '@zeffuro/zerith-core';

import type { MacroEntry } from '../project/types';

import { executeContentMigrationCommand } from '../../services/contentMigrationCommand';
import { chooseProjectOpenTarget, confirmEditorAction } from '../../services/editorDialogs';
import { browserFsAdapter } from '../../services/fs/browserFsAdapter';
import { isTauriRuntime } from '../../services/runtime/runtimeEnvironment';
import { openProjectInNewEditorWindow } from '../../services/runtime/windowControls';
import { normalizePathForComparison } from '../../utils/pathComparison';
import { type PreparedProject, prepareProjectOpen, projectRootFromManifestPath } from '../project/projectPreparation';
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
    request?: ProjectOpenRequest;
};

export type ProjectOpenRequest = {
    isCurrent: () => boolean;
    isLatest: () => boolean;
    projectGeneration: number;
    projectPath: string | undefined;
};

export type ProjectOpenResult =
    | { status: 'cancelled' }
    | { status: 'opened-current' }
    | { status: 'opened-new-window' };

let openSequence = 0;

export function beginProjectOpenRequest(): ProjectOpenRequest {
    const sequence = ++openSequence;
    const { projectGeneration, projectPath } = useProjectStore.getState();
    const isLatest = () => sequence === openSequence;
    return {
        isCurrent: () => isLatest()
            && useProjectStore.getState().projectGeneration === projectGeneration
            && useProjectStore.getState().projectPath === projectPath,
        isLatest, projectGeneration, projectPath,
    };
}


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
    const request = options.request ?? beginProjectOpenRequest();
    const { projectGeneration, projectPath: currentProjectPath } = request;
    const ownsSession = request.isCurrent;
    if (!ownsSession()) return { status: 'cancelled' };
    if (!isTauriRuntime()) {
        try {
            await browserFsAdapter.prepareProject(manifestPath);
        } catch (error) {
            if (ownsSession()) useEditorStore.getState().announceOperationStatus(`Could not open project: ${formatError(error)}`, 'error');
            return { status: 'cancelled' };
        }
    }
    if (!ownsSession()) return { status: 'cancelled' };
    const nextProjectPath = projectRootFromManifestPath(manifestPath);
    const switchingProject = Boolean(
        currentProjectPath
        && normalizePathForComparison(currentProjectPath) !== normalizePathForComparison(nextProjectPath),
    );

    const openTarget = await resolveProjectOpenTarget({
        currentProjectPath,
        nextProjectPath,
        options,
        switchingProject,
    });

    if (!ownsSession()) return { status: 'cancelled' };
    if (openTarget === 'cancelled') return { status: 'cancelled' };

    if (openTarget === 'new-window') {
        try {
            await openProjectInNewEditorWindow(manifestPath);
            return { status: 'opened-new-window' };
        } catch (error) {
            if (!ownsSession()) return { status: 'cancelled' };
            console.error('Failed to open project in a new editor window:', error);
            globalThis.alert?.(`Failed to open project in a new editor window: ${formatError(error)}`);
            return { status: 'cancelled' };
        }
    }

    let prepared: PreparedProject | undefined;
    const prepare = async () => {
        try {
            prepared = await prepareProjectOpen(manifestPath);
            return ownsSession();
        } catch (error) {
            if (ownsSession()) useEditorStore.getState().announceOperationStatus(`Could not open project: ${formatError(error)}`, 'error');
            return false;
        }
    };
    if ((!currentProjectPath || switchingProject) && !await prepare()) return { status: 'cancelled' };

    if (options.checkMigration !== false) {
        const changed = await checkProjectContentMigration(nextProjectPath, ownsSession);
        if (!ownsSession()) return { status: 'cancelled' };
        if (changed && prepared && !await prepare()) return { status: 'cancelled' };
    }

    if (switchingProject && useProjectStore.getState().dirtyFiles.size > 0) {
        useEditorStore.getState().markManualSave();
        const saveResult = await useProjectStore.getState().saveAllDirtyFiles();
        if (!ownsSession()) return { status: 'cancelled' };
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

    if (!ownsSession()) return { status: 'cancelled' };
    let ownsOpenedProject = ownsSession;
    if (currentProjectPath && !switchingProject) {
        if (!await useProjectStore.getState().loadManifest()) {
            if (ownsSession()) useEditorStore.getState().announceOperationStatus(
                'Could not refresh project. Your open files and unsaved edits have been kept. Check game.json and its referenced files, then try again.',
                'error',
            );
            return { status: 'cancelled' };
        }
    } else {
        const opened = await useProjectStore.getState().openProjectFromManifest(manifestPath, prepared);
        ownsOpenedProject = () => request.isLatest()
            && useProjectStore.getState().projectGeneration === projectGeneration + 1
            && useProjectStore.getState().projectPath === prepared?.projectRoot;
        if (!opened) {
            if (ownsSession()) useEditorStore.getState().announceOperationStatus('Project could not be opened.', 'error');
            return { status: 'cancelled' };
        }
        if (!ownsOpenedProject()) return { status: 'cancelled' };
        if (switchingProject) useWorkbenchStore.getState().clearTabs();
    }
    if (!ownsOpenedProject()) return { status: 'cancelled' };
    if (!isTauriRuntime()) {
        try {
            await browserFsAdapter.recentProjects.remember(manifestPath);
        } catch {
            if (ownsOpenedProject()) useEditorStore.getState().announceOperationStatus('Project opened, but this browser could not remember its folder.', 'warning');
        }
    }
    return { status: ownsOpenedProject() ? 'opened-current' : 'cancelled' };
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

async function checkProjectContentMigration(projectPath: string, ownsSession: () => boolean): Promise<boolean> {
    try {
        const result = await executeContentMigrationCommand(projectPath);
        return (result.status === 'applied' || result.status === 'conflicted') && result.application.written.length > 0;
    } catch (error) {
        if (!ownsSession()) return false;
        console.error('Project migration check failed:', error);
        globalThis.alert?.(`Project migration check failed. Opening will continue.\n\n${formatError(error)}`);
        return true;
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


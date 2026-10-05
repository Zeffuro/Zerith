import { createNewProject, type NewProjectOptions } from '../../services/createNewProject';
import { confirmEditorAction } from '../../services/editorDialogs';
import { assertProjectDestinationCurrent } from '../../services/projectDestination';
import { saveProjectAs } from '../../services/saveProjectAs';
import { useProjectStore } from '../storeBootstrap';
import { useEditorStore } from '../useEditorStore';
import { beginProjectOpenRequest, executeOpenProjectInCurrentWindow } from './projectOpenActions';

export async function createAndOpenNewProject(options: NewProjectOptions) {
    const request = beginProjectOpenRequest();
    let saved = false;
    const isCurrent = () => request.isCurrent() && (options.isCurrent?.() ?? true)
        && (!saved || useProjectStore.getState().dirtyFiles.size === 0);
    if (request.projectPath) {
        const confirmed = await confirmEditorAction({
            cancelText: 'Cancel',
            confirmText: 'Create and Open',
            message: 'Create this project and open it here? Existing tabs will close. Unsaved files will be saved first.',
            title: 'New Project',
        });
        if (!confirmed) return;
    }
    assertProjectDestinationCurrent({ isCurrent });
    await saveSource(isCurrent);
    saved = true;
    const result = await createNewProject({ ...options, isCurrent, sourcePath: request.projectPath });
    if (!isCurrent()) throw new Error(`The project or request changed. Project output remains at ${result.projectPath}.`);
    const opened = await executeOpenProjectInCurrentWindow(result.manifestPath, {
        allowNewWindow: false, checkMigration: false, prompt: false, request: { ...request, isCurrent },
    });
    if (opened.status !== 'opened-current') {
        throw new Error(`Project created at ${result.projectPath}, but it could not be opened. Your current project was kept.`);
    }
    return result;
}

export async function saveAndOpenProjectAs() {
    const request = beginProjectOpenRequest();
    if (!request.projectPath) return;
    let saved = false;
    const isCurrent = () => request.isCurrent() && (!saved || useProjectStore.getState().dirtyFiles.size === 0);
    const result = await saveProjectAs(request.projectPath, {
        beforeCopy: async () => {
            await saveSource(isCurrent);
            saved = true;
        },
        isCurrent,
    });
    if (!result) return;
    if (!isCurrent()) throw new Error(`The project or request changed. Project output remains at ${result.projectPath}.`);
    const opened = await executeOpenProjectInCurrentWindow(result.manifestPath, {
        allowNewWindow: false, checkMigration: false, prompt: false, request: { ...request, isCurrent },
    });
    if (opened.status !== 'opened-current') {
        throw new Error(`Project copy remains at ${result.projectPath}, but it could not be opened. Your current project was kept.`);
    }
    return result;
}

async function saveSource(isCurrent: () => boolean): Promise<void> {
    const check = () => assertProjectDestinationCurrent({ isCurrent });
    check();
    useEditorStore.getState().markManualSave();
    const result = await useProjectStore.getState().saveAllDirtyFiles();
    check();
    if (result.failed.length > 0 || result.skipped.length > 0 || useProjectStore.getState().dirtyFiles.size > 0) {
        throw new Error(`Source save did not complete. Save your edits before continuing. ${[...result.failed, ...result.skipped].join(', ')}`);
    }
}

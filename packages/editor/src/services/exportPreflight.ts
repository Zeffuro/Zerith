import type { ProjectState } from '../store/project/types';

type ExportProjectState = Pick<ProjectState, 'dirtyFiles' | 'projectGeneration' | 'projectPath' | 'saveAllDirtyFiles'>;

export async function saveProjectBeforeExport(projectPath: string, getState: () => ExportProjectState): Promise<void> {
    const initial = getState();
    if (initial.projectPath !== projectPath) throw new Error('The project changed. Start export again.');
    const generation = initial.projectGeneration;

    const result = await initial.saveAllDirtyFiles();
    const current = getState();
    if (current.projectPath !== projectPath || current.projectGeneration !== generation) {
        throw new Error('The project changed while saving. Start export again.');
    }
    if (result.failed.length > 0 || result.skipped.length > 0) {
        const files = [...new Set([...result.failed, ...result.skipped])];
        throw new Error(`Save did not complete for ${files.join(', ')}. Save these files before exporting.`);
    }
    if (current.dirtyFiles.size > 0) {
        throw new Error('Some edits changed while saving. Save them before exporting.');
    }
}

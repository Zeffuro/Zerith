import type { ProjectState } from '../store/project/types';
import type { ProjectValidationCommandResult } from './projectValidationCommand';

import { executeConsoleMessageAction } from '../store/actions/consoleMessageActions';
import { useProjectStore } from '../store/storeBootstrap';
import { useEditorStore } from '../store/useEditorStore';
import { executeProjectValidationCommand } from './projectValidationCommand';

export type ProjectValidationRunResult = { message: string; status: 'cancelled' } | ProjectValidationCommandResult;
export type ProjectValidationSession = Pick<ProjectState, 'projectGeneration' | 'projectPath'>;

type ValidationProject = Pick<ProjectState, 'dirtyFiles' | 'saveAllDirtyFiles'> & ProjectValidationSession;
type ValidationRunDependencies = {
    cancel: (message: string) => void;
    execute: (projectPath: string, isCurrent: () => boolean) => Promise<ProjectValidationCommandResult>;
    getProject: () => ValidationProject;
    markManualSave: () => void;
};

export function createProjectValidationRunner(dependencies: ValidationRunDependencies) {
    let sequence = 0;
    let retirePrevious: (() => void) | undefined;
    return async (session: ProjectValidationSession, isActive: () => boolean = () => true): Promise<ProjectValidationRunResult> => {
        const ownsSession = () => isActive() && matchesProjectValidationSession(dependencies.getProject(), session);
        if (!ownsSession()) return { status: 'retired' };
        if (!session.projectPath) return { status: 'no-project' };
        const request = ++sequence;
        retirePrevious?.();
        const retired = Symbol('retired');
        const retirement = new Promise<typeof retired>(resolve => { retirePrevious = () => { resolve(retired); }; });
        const isCurrent = () => request === sequence && ownsSession();
        const cancel = (message: string): ProjectValidationRunResult => {
            dependencies.cancel(message);
            return { message, status: 'cancelled' };
        };
        const unsavedMessage = 'Validation cancelled because not all dirty files could be saved.';

        try {
            const project = dependencies.getProject();
            if (project.dirtyFiles.size > 0) {
                dependencies.markManualSave();
                if (!isCurrent()) return { status: 'retired' };
                const saved = await Promise.race([project.saveAllDirtyFiles(), retirement]);
                if (saved === retired || !isCurrent()) return { status: 'retired' };
                if (saved.failed.length > 0 || dependencies.getProject().dirtyFiles.size > 0) return cancel(unsavedMessage);
            }

            if (!isCurrent()) return { status: 'retired' };
            if (dependencies.getProject().dirtyFiles.size > 0) return cancel(unsavedMessage);
            const result = await Promise.race([dependencies.execute(session.projectPath, () => isCurrent() && dependencies.getProject().dirtyFiles.size === 0), retirement]);
            if (result === retired || !isCurrent()) return { status: 'retired' };
            if (dependencies.getProject().dirtyFiles.size > 0) return cancel('Validation cancelled because files changed while validation was running.');
            return result;
        } catch (error) {
            if (!isCurrent()) return { status: 'retired' };
            return cancel(`Validation cancelled: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            if (request === sequence) retirePrevious = undefined;
        }
    };
}

export function matchesProjectValidationSession(current: ProjectValidationSession, captured: ProjectValidationSession): boolean {
    return current.projectPath === captured.projectPath && current.projectGeneration === captured.projectGeneration;
}

// Both entry points share one owner, while a palette action survives normal dismissal.
export const runSavedProjectValidation = createProjectValidationRunner({
    cancel: message => {
        executeConsoleMessageAction('editor', 'warn', message);
        useEditorStore.getState().announceOperationStatus(message, 'error');
    },
    execute: (path, isCurrent) => executeProjectValidationCommand(path, undefined, isCurrent),
    getProject: useProjectStore.getState,
    markManualSave: () => useEditorStore.getState().markManualSave(),
});

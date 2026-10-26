import type { ProjectState } from '../store/project/types';
import type { ContentMigrationCommandResult, ContentMigrationCommandStatusTone } from './contentMigrationCommand';

import { useProjectStore } from '../store/storeBootstrap';
import { useEditorStore } from '../store/useEditorStore';
import { executeContentMigrationCommand, formatContentMigrationCommandStatus, getContentMigrationCommandStatusTone } from './contentMigrationCommand';

type Dependencies = {
    announce: (message: string, tone?: ContentMigrationCommandStatusTone) => void;
    execute: (path: string, isCurrent: () => boolean) => Promise<ContentMigrationCommandResult>;
    getProject: () => Project;
    markManualSave: () => void;
};
type Project = Pick<ProjectState, 'dirtyFiles' | 'loadManifest' | 'saveAllDirtyFiles'> & Session;
type RunResult = { message: string; status: 'save-cancelled' } | ContentMigrationCommandResult;
type Session = Pick<ProjectState, 'projectGeneration' | 'projectPath'>;

export function createContentMigrationRunner(dependencies: Dependencies) {
    let sequence = 0;
    let retirePrevious: (() => void) | undefined;
    const run = async (path: string | undefined, ownsSession: () => boolean, refresh: boolean): Promise<RunResult> => {
        if (!ownsSession()) return { status: 'retired' };
        if (!path) return { status: 'no-project' };
        const request = ++sequence;
        retirePrevious?.();
        const retired = Symbol('retired');
        const retirement = new Promise<typeof retired>(resolve => { retirePrevious = () => { resolve(retired); }; });
        const isCurrent = () => request === sequence && ownsSession();
        const hasEdits = () => dependencies.getProject().projectPath === path && dependencies.getProject().dirtyFiles.size > 0;
        const cancel = (message: string): RunResult => {
            dependencies.announce(message, 'error');
            return { message, status: 'save-cancelled' };
        };
        try {
            if (hasEdits()) {
                dependencies.markManualSave();
                if (!isCurrent()) return { status: 'retired' };
                const saved = await Promise.race([dependencies.getProject().saveAllDirtyFiles(), retirement]);
                if (saved === retired || !isCurrent()) return { status: 'retired' };
                if (saved.failed.length > 0 || hasEdits()) return cancel('Content migration cancelled because not all dirty files could be saved.');
            }
            if (!isCurrent()) return { status: 'retired' };
            if (hasEdits()) return cancel('Content migration cancelled because files changed before migration started.');
            if (refresh) dependencies.announce('Content migration started. The editor remains usable while files are checked.');
            const result = await Promise.race([dependencies.execute(path, () => isCurrent() && !hasEdits()), retirement]);
            if (result === retired || !isCurrent()) return { status: 'retired' };
            if (hasEdits()) return cancel(`Content migration stopped because files were edited while it was running.${'application' in result && result.application ? ` ${result.application.written.length} file(s) were already written.` : ''}`);
            if (refresh && 'application' in result && result.application && result.status !== 'retired') {
                const reloaded = await Promise.race([dependencies.getProject().loadManifest(), retirement]);
                if (reloaded === retired || !isCurrent()) return { status: 'retired' };
                if (!reloaded) {
                    dependencies.announce(`${formatContentMigrationCommandStatus(result)} The project could not be refreshed; reopen it to see the saved changes.`, 'warning');
                    return result;
                }
            }
            if (refresh && result.status !== 'retired') dependencies.announce(formatContentMigrationCommandStatus(result), getContentMigrationCommandStatusTone(result));
            return result;
        } catch (error) {
            if (!isCurrent()) return { status: 'retired' };
            if (!refresh) throw error;
            return cancel(`Content migration failed: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            if (request === sequence) retirePrevious = undefined;
        }
    };
    return {
        runForOpen: (path: string, ownsSession: () => boolean) => run(path, ownsSession, false),
        runSaved: (session: Session) => run(session.projectPath, () => {
            const current = dependencies.getProject();
            return current.projectPath === session.projectPath && current.projectGeneration === session.projectGeneration;
        }, true),
    };
}

const runner = createContentMigrationRunner({
    announce: (message, tone) => useEditorStore.getState().announceOperationStatus(message, tone),
    execute: (path, isCurrent) => executeContentMigrationCommand(path, undefined, isCurrent),
    getProject: useProjectStore.getState,
    markManualSave: () => useEditorStore.getState().markManualSave(),
});

export const runSavedContentMigration = runner.runSaved;
export const runProjectOpenContentMigration = runner.runForOpen;

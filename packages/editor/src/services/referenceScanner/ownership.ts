import type { ProjectState } from '../../store/project/types';

export type ReferenceScannerInputs = Pick<ProjectState,
    'characters' | 'items' | 'macros' | 'manifest' | 'projectGeneration' | 'projectPath' | 'scenes' | 'treeRevision'>;

export function createReferenceScanOwnership() {
    let revision = 0;
    let sequence = 0;
    return {
        begin(project: ReferenceScannerInputs, getProject: () => ReferenceScannerInputs, isCurrent: () => boolean) {
            const capturedRevision = revision;
            const request = ++sequence;
            return () => isCurrent() && capturedRevision === revision && request === sequence
                && !referenceScannerInputsChanged(getProject(), project);
        },
        invalidate() { revision++; },
    };
}

export function referenceScannerInputsChanged(current: ReferenceScannerInputs, previous: ReferenceScannerInputs): boolean {
    return current.characters !== previous.characters
        || current.items !== previous.items
        || current.macros !== previous.macros
        || current.manifest !== previous.manifest
        || current.projectGeneration !== previous.projectGeneration
        || current.projectPath !== previous.projectPath
        || current.scenes !== previous.scenes
        || current.treeRevision !== previous.treeRevision;
}

export const referenceScanOwnership = createReferenceScanOwnership();

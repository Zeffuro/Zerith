import type { ScriptPath } from '../../../utils/scriptPathUtilities';

export type SceneComposerSelectionSummary = {
    breadcrumb: string | undefined;
    count: number;
    path: ScriptPath | undefined;
    pathKey: string | undefined;
};

export function formatSceneComposerPath(path: ScriptPath): string {
    if (path.length === 0) {
        return 'Scene root';
    }

    const parts: string[] = [];
    for (let index = 0; index < path.length; index += 1) {
        const segment = path[index];
        const next = path[index + 1];

        if (typeof segment === 'number') {
            parts.push(`Command ${segment + 1}`);
            continue;
        }

        if (segment === 'options') {
            if (typeof next === 'number') {
                parts.push(`Option ${next + 1}`);
                index += 1;
            } else {
                parts.push('Options');
            }
            continue;
        }

        if (segment === 'commands') {
            if (typeof next === 'number') {
                parts.push(`Command ${next + 1}`);
                index += 1;
            } else {
                parts.push('Commands');
            }
            continue;
        }

        parts.push(formatSceneComposerPathSegment(segment));
    }

    return parts.join(' > ');
}

export function summarizeSceneComposerSelection(
    selectedPaths: readonly ScriptPath[],
    totalCommands: number,
): SceneComposerSelectionSummary {
    const path = resolveSceneComposerSelectionPath(selectedPaths, totalCommands);
    return {
        breadcrumb: path ? formatSceneComposerPath(path) : undefined,
        count: selectedPaths.length,
        path,
        pathKey: path ? path.join('.') : undefined,
    };
}

function formatSceneComposerPathSegment(segment: string): string {
    switch (segment) {
        case 'body': {
            return 'Body';
        }
        case 'onFalse': {
            return 'False branch';
        }
        case 'onTrue': {
            return 'True branch';
        }
        default: {
            return segment.replaceAll(/[_-]+/gu, ' ');
        }
    }
}

function resolveSceneComposerSelectionPath(
    selectedPaths: readonly ScriptPath[],
    totalCommands: number,
): ScriptPath | undefined {
    for (const path of selectedPaths) {
        const [rootIndex] = path;
        if (
            typeof rootIndex === 'number'
            && rootIndex >= 0
            && rootIndex < totalCommands
        ) {
            return [...path];
        }
    }

    return undefined;
}

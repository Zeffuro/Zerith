import { executeWorkbenchOpenAction } from '../store/actions/workbenchOpenActions';

export type OpenGitDiffWorkbenchTabOptions = {
    filePath: string;
    projectPath: string;
    rawDiff: string;
    repositoryRoot?: string;
};

export function openGitDiffWorkbenchTab(options: OpenGitDiffWorkbenchTabOptions): boolean {
    const projectRoot = trimTrailingSlashes(options.repositoryRoot ?? options.projectPath);
    const filePath = options.filePath.trim();
    if (!projectRoot || !filePath) return false;

    const path = `${projectRoot}#git-diff/${filePath}`;
    executeWorkbenchOpenAction({
        action: 'openTab',
        tab: {
            gitDiffFilePath: filePath,
            gitDiffRepositoryRoot: projectRoot,
            id: `gitDiff::${path}`,
            kind: 'gitDiff',
            path,
            textContent: options.rawDiff,
            title: `Diff: ${basename(filePath)}`,
        },
    });

    return true;
}

function basename(path: string): string {
    return path.split('/').filter(Boolean).at(-1) ?? path;
}

function trimTrailingSlashes(path: string): string {
    return path.trim().replace(/[\\/]+$/u, '');
}

import {
    createBrowserParityReport,
    type EditorRuntimeSurface,
} from './browserParityReport';

export type BrowserEditorReadinessOptions = {
    browserFileSystemAccess?: boolean;
    runtime: EditorRuntimeSurface;
};

export type BrowserEditorReadinessReport = {
    blocked: number;
    limited: number;
    ready: number;
    requirements: BrowserEditorReadinessRequirement[];
    runtime: EditorRuntimeSurface;
    status: BrowserEditorReadinessRequirementStatus;
};

export type BrowserEditorReadinessRequirement = {
    detail: string;
    id: BrowserEditorReadinessRequirementId;
    label: string;
    status: BrowserEditorReadinessRequirementStatus;
    summary: string;
};

export type BrowserEditorReadinessRequirementId =
    | 'browserExportZip'
    | 'browserProjectFilesystem'
    | 'browserShell'
    | 'desktopOnlyIntegrations'
    | 'looseDirectoryExport'
    | 'playerBuildParity';

export type BrowserEditorReadinessRequirementStatus = 'blocked' | 'limited' | 'ready';

export function createBrowserEditorReadinessReport(
    options: BrowserEditorReadinessOptions,
): BrowserEditorReadinessReport {
    const parity = createBrowserParityReport({
        browserFileSystemAccess: options.browserFileSystemAccess,
        runtime: 'browser',
    });
    const projectFileSystem = parity.capabilities.find((capability) => capability.id === 'projectFileSystem')?.browser;

    const requirements: BrowserEditorReadinessRequirement[] = [
        {
            detail: 'The editor shell runs in browser mode and browser visual smoke covers no-project and mounted-project authoring flows.',
            id: 'browserShell',
            label: 'Browser editor shell',
            status: 'ready',
            summary: 'The editor can run as a browser app.',
        },
        {
            detail: projectFileSystem === 'limited'
                ? 'The browser exposes picker APIs, but real projects still depend on user-granted handles and browser persistence limits.'
                : 'This browser does not expose the File System Access picker API required for mounted project editing.',
            id: 'browserProjectFilesystem',
            label: 'Project filesystem',
            status: projectFileSystem === 'limited' ? 'limited' : 'blocked',
            summary: projectFileSystem === 'limited'
                ? 'Project access works behind user-granted browser handles.'
                : 'Project access is blocked without browser picker support.',
        },
        {
            detail: 'Browser export produces a playable ZIP from the mounted project or writes a new folder through a user-granted directory handle.',
            id: 'browserExportZip',
            label: 'Browser export',
            status: 'limited',
            summary: 'Browser export offers a ZIP download or, with picker support, a new folder.',
        },
        {
            detail: 'Browser export remaps a prebuilt player shell while desktop export runs the canonical Vite player build.',
            id: 'playerBuildParity',
            label: 'Player build parity',
            status: 'limited',
            summary: 'Browser and desktop exports are comparable but use different build mechanics.',
        },
        {
            detail: 'System reveal, native window close, and repository writes remain desktop-first capabilities.',
            id: 'desktopOnlyIntegrations',
            label: 'Desktop integrations',
            status: 'blocked',
            summary: 'Native integrations stay disabled or limited in browser builds.',
        },
        {
            detail: 'Folder export requires a user-selected parent and a new subfolder outside the source project. Arbitrary filesystem paths are unavailable.',
            id: 'looseDirectoryExport',
            label: 'Loose directory export',
            status: options.browserFileSystemAccess ? 'ready' : 'blocked',
            summary: options.browserFileSystemAccess ? 'Browser exports can be saved in a new user-selected folder.' : 'Folder export requires browser picker support.',
        },
    ];
    const ready = requirements.filter((requirement) => requirement.status === 'ready').length;
    const limited = requirements.filter((requirement) => requirement.status === 'limited').length;
    const blocked = requirements.filter((requirement) => requirement.status === 'blocked').length;

    return {
        blocked,
        limited,
        ready,
        requirements,
        runtime: options.runtime,
        status: blocked > 0 ? 'blocked' : (limited > 0 ? 'limited' : 'ready'),
    };
}

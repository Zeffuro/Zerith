export type DesktopCapabilityPrivacyReadinessReport = {
    blocked: number;
    limited: number;
    ready: number;
    requirements: DesktopCapabilityPrivacyRequirement[];
    status: DesktopCapabilityPrivacyRequirementStatus;
};

export type DesktopCapabilityPrivacyRequirement = {
    detail: string;
    id: DesktopCapabilityPrivacyRequirementId;
    label: string;
    status: DesktopCapabilityPrivacyRequirementStatus;
    summary: string;
};

export type DesktopCapabilityPrivacyRequirementId =
    | 'authoringFileAccess'
    | 'broadAssetProtocol'
    | 'broadFilesystemScope'
    | 'broadOpenPathScope'
    | 'localConsoleCapture'
    | 'nativeCommandSurface'
    | 'packagedGameBoundary';

export type DesktopCapabilityPrivacyRequirementStatus = 'blocked' | 'limited' | 'ready';

const DESKTOP_CAPABILITY_PRIVACY_REQUIREMENTS: readonly DesktopCapabilityPrivacyRequirement[] = [
    {
        detail: 'The editor opens user-selected local projects and uses filesystem operations for authoring, validation, asset organization, exports, and plugin package inspection.',
        id: 'authoringFileAccess',
        label: 'Authoring file access',
        status: 'ready',
        summary: 'Desktop project authoring has an explicit local-file purpose.',
    },
    {
        detail: 'The current Tauri capability grants read, write, mkdir, rename, remove, and directory reads with a ** path scope so arbitrary project folders can be edited.',
        id: 'broadFilesystemScope',
        label: 'Filesystem scope',
        status: 'limited',
        summary: 'Filesystem access is intentionally broad for the editor and should stay out of packaged game shells.',
    },
    {
        detail: 'The opener capability can reveal local paths and open URLs; this is useful for source/reveal actions but should remain user-triggered and bounded to editor workflows.',
        id: 'broadOpenPathScope',
        label: 'Open path and URL scope',
        status: 'limited',
        summary: 'Path and URL opening are desktop conveniences that need user-visible triggers.',
    },
    {
        detail: 'The Tauri asset protocol is enabled with a ** scope and CSP is not currently constrained, which is acceptable only as an editor-shell posture until a tighter policy is designed.',
        id: 'broadAssetProtocol',
        label: 'Asset protocol scope',
        status: 'limited',
        summary: 'Local asset serving is broad and should be revisited before wider desktop distribution.',
    },
    {
        detail: 'Native commands cover export, Git operations, and project file watching. They are project-authoring features and should not be inherited by a packaged player shell.',
        id: 'nativeCommandSurface',
        label: 'Native command surface',
        status: 'limited',
        summary: 'Native commands are editor-scoped rather than runtime-game-scoped.',
    },
    {
        detail: 'The Console panel captures raw console arguments and export output locally, so local paths and workstation errors can appear in the UI. This is useful for debugging but not intended as share-safe telemetry.',
        id: 'localConsoleCapture',
        label: 'Local console capture',
        status: 'limited',
        summary: 'Logs stay local but may include local paths or command output.',
    },
    {
        detail: 'Desktop game export remains separated by the desktop-packaging readiness report: packaged games need their own player shell and scoped runtime permissions.',
        id: 'packagedGameBoundary',
        label: 'Packaged game boundary',
        status: 'ready',
        summary: 'The editor shell is not treated as the packaged game shell.',
    },
];

export function createDesktopCapabilityPrivacyReadinessReport(): DesktopCapabilityPrivacyReadinessReport {
    const requirements = DESKTOP_CAPABILITY_PRIVACY_REQUIREMENTS.map((requirement) => ({ ...requirement }));
    const ready = requirements.filter((requirement) => requirement.status === 'ready').length;
    const limited = requirements.filter((requirement) => requirement.status === 'limited').length;
    const blocked = requirements.filter((requirement) => requirement.status === 'blocked').length;

    return {
        blocked,
        limited,
        ready,
        requirements,
        status: blocked > 0 ? 'blocked' : (limited > 0 ? 'limited' : 'ready'),
    };
}

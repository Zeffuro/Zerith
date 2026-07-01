export type DesktopPackagingReadinessReport = {
    blocked: number;
    ready: number;
    requirements: DesktopPackagingRequirement[];
    status: DesktopPackagingRequirementStatus;
};

export type DesktopPackagingRequirement = {
    detail: string;
    id: DesktopPackagingRequirementId;
    label: string;
    status: DesktopPackagingRequirementStatus;
    summary: string;
};

export type DesktopPackagingRequirementId =
    | 'exportArtifactContract'
    | 'packagingCommand'
    | 'runtimeSmokeGate'
    | 'scopedGamePermissions'
    | 'separatePlayerShell';

export type DesktopPackagingRequirementStatus = 'blocked' | 'ready';

const DESKTOP_PACKAGING_REQUIREMENTS: readonly DesktopPackagingRequirement[] = [
    {
        detail: 'Browser and desktop export parity checks can compare the required runtime and project files before a package target is added.',
        id: 'exportArtifactContract',
        label: 'Export artifact contract',
        status: 'ready',
        summary: 'Loose player exports already produce comparable runtime artifacts.',
    },
    {
        detail: 'The exported runtime smoke boots first-party fixtures in Chromium and can assert fixture-specific dialogue after build.',
        id: 'runtimeSmokeGate',
        label: 'Runtime smoke gate',
        status: 'ready',
        summary: 'Safe exported games can be booted and advanced before shipping.',
    },
    {
        detail: 'The current Tauri app is the editor shell and uses the editor identifier; packaged games need their own player app shell and bundle identity.',
        id: 'separatePlayerShell',
        label: 'Separate player shell',
        status: 'blocked',
        summary: 'Do not ship exported games inside the editor Tauri app.',
    },
    {
        detail: 'The editor capability allows broad filesystem and open-path access for authoring; packaged games need narrow runtime-only permissions.',
        id: 'scopedGamePermissions',
        label: 'Scoped game permissions',
        status: 'blocked',
        summary: 'Game packages need a tighter capability set than the editor.',
    },
    {
        detail: 'Desktop editor export still invokes the web/player build path; there is no packaged game build command to run from CI yet.',
        id: 'packagingCommand',
        label: 'Package command',
        status: 'blocked',
        summary: 'Add a package command only after the player shell exists.',
    },
];

export function createDesktopPackagingReadinessReport(): DesktopPackagingReadinessReport {
    const requirements = DESKTOP_PACKAGING_REQUIREMENTS.map((requirement) => ({ ...requirement }));
    const ready = requirements.filter((requirement) => requirement.status === 'ready').length;
    const blocked = requirements.filter((requirement) => requirement.status === 'blocked').length;

    return {
        blocked,
        ready,
        requirements,
        status: blocked > 0 ? 'blocked' : 'ready',
    };
}

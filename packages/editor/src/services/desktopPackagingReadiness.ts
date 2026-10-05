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
        detail: 'The Windows desktop smoke launches a player and game archive without Node or Rust, advances fixture dialogue and checks that authoring access is denied.',
        id: 'runtimeSmokeGate',
        label: 'Runtime smoke gate',
        status: 'ready',
        summary: 'Standalone Windows games can be booted and advanced before shipping.',
    },
    {
        detail: 'The prebuilt player loads a local game archive with its own title, save namespace and window settings.',
        id: 'separatePlayerShell',
        label: 'Separate player shell',
        status: 'ready',
        summary: 'Games use a dedicated player, title and isolated saved data.',
    },
    {
        detail: 'The player grants only display controls. It loads game archive content without authoring plugins or file access commands.',
        id: 'scopedGamePermissions',
        label: 'Scoped game permissions',
        status: 'ready',
        summary: 'Game packages have access to their own archive and display controls.',
    },
    {
        detail: 'The desktop package command and editor copy a verified prebuilt player and package game content without invoking a compiler.',
        id: 'packagingCommand',
        label: 'Package command',
        status: 'ready',
        summary: 'Package a game into a new directory without installing Rust.',
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

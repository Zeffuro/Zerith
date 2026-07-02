export type GitHubPagesDualSiteReadinessReport = {
    blocked: number;
    ready: number;
    requirements: GitHubPagesDualSiteRequirement[];
    status: GitHubPagesDualSiteRequirementStatus;
};

export type GitHubPagesDualSiteRequirement = {
    detail: string;
    id: GitHubPagesDualSiteRequirementId;
    label: string;
    status: GitHubPagesDualSiteRequirementStatus;
    summary: string;
};

export type GitHubPagesDualSiteRequirementId =
    | 'browserEditorPersistence'
    | 'dualArtifactWorkflow'
    | 'pagesBasePathSmoke'
    | 'playableExampleDeploy'
    | 'routeIsolation';

export type GitHubPagesDualSiteRequirementStatus = 'blocked' | 'ready';

const GITHUB_PAGES_DUAL_SITE_REQUIREMENTS: readonly GitHubPagesDualSiteRequirement[] = [
    {
        detail: 'The example-game Pages workflow builds a first-party playable export and runs the exported runtime smoke before uploading the artifact.',
        id: 'playableExampleDeploy',
        label: 'Playable deploy gate',
        status: 'ready',
        summary: 'The example-game Pages artifact is smoke-tested before upload.',
    },
    {
        detail: 'The exported runtime smoke can serve artifacts under a non-root Pages-style base path and assert fixture-specific dialogue.',
        id: 'pagesBasePathSmoke',
        label: 'Pages base-path smoke',
        status: 'ready',
        summary: 'Playable exports can be checked under repository base paths.',
    },
    {
        detail: 'Browser editor sessions run without Tauri APIs and rely on the browser project-access policy tracked by the browser parity report.',
        id: 'browserEditorPersistence',
        label: 'Browser editor persistence',
        status: 'ready',
        summary: 'Browser project limits are tracked separately from the Pages deploy gate.',
    },
    {
        detail: 'The Pages workflow builds the browser editor and example-game into one Pages artifact with explicit subdirectories.',
        id: 'dualArtifactWorkflow',
        label: 'Dual artifact workflow',
        status: 'ready',
        summary: 'The Pages artifact owns both the browser editor and playable export.',
    },
    {
        detail: 'The browser editor is built under /editor/ and the playable export under /example-game/ so asset bases stay isolated.',
        id: 'routeIsolation',
        label: 'Route and base isolation',
        status: 'ready',
        summary: 'The browser editor and playable export have separate Pages base paths.',
    },
];

export function createGitHubPagesDualSiteReadinessReport(): GitHubPagesDualSiteReadinessReport {
    const requirements = GITHUB_PAGES_DUAL_SITE_REQUIREMENTS.map((requirement) => ({ ...requirement }));
    const ready = requirements.filter((requirement) => requirement.status === 'ready').length;
    const blocked = requirements.filter((requirement) => requirement.status === 'blocked').length;

    return {
        blocked,
        ready,
        requirements,
        status: blocked > 0 ? 'blocked' : 'ready',
    };
}

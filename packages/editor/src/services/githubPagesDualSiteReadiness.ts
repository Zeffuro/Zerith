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
        detail: 'Browser editor sessions still depend on picker support, user-granted handles, and browser storage limits for real project work.',
        id: 'browserEditorPersistence',
        label: 'Browser editor persistence',
        status: 'blocked',
        summary: 'Dual deployment needs a clearer browser project persistence policy.',
    },
    {
        detail: 'There is no workflow that builds, names, and uploads both the browser editor and playable export artifacts with explicit ownership.',
        id: 'dualArtifactWorkflow',
        label: 'Dual artifact workflow',
        status: 'blocked',
        summary: 'Editor and playable artifacts need an intentional workflow contract.',
    },
    {
        detail: 'A dual Pages site needs stable route and asset-base isolation so the editor shell and playable export cannot break each other.',
        id: 'routeIsolation',
        label: 'Route and base isolation',
        status: 'blocked',
        summary: 'Editor and player routes need a planned URL layout.',
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

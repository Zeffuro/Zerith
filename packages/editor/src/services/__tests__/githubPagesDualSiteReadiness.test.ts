import { describe, expect, it } from 'vitest';

import { createGitHubPagesDualSiteReadinessReport } from '../githubPagesDualSiteReadiness';

describe('githubPagesDualSiteReadiness', () => {
    it('keeps dual-site Pages deployment blocked until browser editor and workflow requirements exist', () => {
        const report = createGitHubPagesDualSiteReadinessReport();

        expect(report.status).toBe('blocked');
        expect(report.ready).toBe(2);
        expect(report.blocked).toBe(3);
        expect(report.requirements.map((requirement) => [requirement.id, requirement.status])).toEqual([
            ['playableExampleDeploy', 'ready'],
            ['pagesBasePathSmoke', 'ready'],
            ['browserEditorPersistence', 'blocked'],
            ['dualArtifactWorkflow', 'blocked'],
            ['routeIsolation', 'blocked'],
        ]);
    });

    it('returns fresh requirement objects for export UI callers', () => {
        const report = createGitHubPagesDualSiteReadinessReport();
        report.requirements[0].summary = 'mutated';

        expect(createGitHubPagesDualSiteReadinessReport().requirements[0].summary)
            .toBe('The example-game Pages artifact is smoke-tested before upload.');
    });
});

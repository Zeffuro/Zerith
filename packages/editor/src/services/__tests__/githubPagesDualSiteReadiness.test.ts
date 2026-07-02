import { describe, expect, it } from 'vitest';

import { createGitHubPagesDualSiteReadinessReport } from '../githubPagesDualSiteReadiness';

describe('githubPagesDualSiteReadiness', () => {
    it('reports the dual-site Pages deployment contract as ready', () => {
        const report = createGitHubPagesDualSiteReadinessReport();

        expect(report.status).toBe('ready');
        expect(report.ready).toBe(5);
        expect(report.blocked).toBe(0);
        expect(report.requirements.map((requirement) => [requirement.id, requirement.status])).toEqual([
            ['playableExampleDeploy', 'ready'],
            ['pagesBasePathSmoke', 'ready'],
            ['browserEditorPersistence', 'ready'],
            ['dualArtifactWorkflow', 'ready'],
            ['routeIsolation', 'ready'],
        ]);
    });

    it('returns fresh requirement objects for export UI callers', () => {
        const report = createGitHubPagesDualSiteReadinessReport();
        report.requirements[0].summary = 'mutated';

        expect(createGitHubPagesDualSiteReadinessReport().requirements[0].summary)
            .toBe('The example-game Pages artifact is smoke-tested before upload.');
    });
});

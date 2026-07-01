import { describe, expect, it } from 'vitest';

import { createBrowserEditorReadinessReport } from '../browserEditorReadiness';

describe('browserEditorReadiness', () => {
    it('reports browser parity as blocked even when picker support is available', () => {
        const report = createBrowserEditorReadinessReport({
            browserFileSystemAccess: true,
            runtime: 'browser',
        });

        expect(report.status).toBe('blocked');
        expect(report.ready).toBe(1);
        expect(report.limited).toBe(3);
        expect(report.blocked).toBe(2);
        expect(report.requirements.map((requirement) => [requirement.id, requirement.status])).toEqual([
            ['browserShell', 'ready'],
            ['browserProjectFilesystem', 'limited'],
            ['browserExportZip', 'limited'],
            ['playerBuildParity', 'limited'],
            ['desktopOnlyIntegrations', 'blocked'],
            ['looseDirectoryExport', 'blocked'],
        ]);
    });

    it('blocks project filesystem readiness without browser picker support', () => {
        const report = createBrowserEditorReadinessReport({
            browserFileSystemAccess: false,
            runtime: 'browser',
        });

        expect(report.blocked).toBe(3);
        expect(report.limited).toBe(2);
        expect(report.requirements.find((requirement) => requirement.id === 'browserProjectFilesystem')).toMatchObject({
            status: 'blocked',
            summary: 'Project access is blocked without browser picker support.',
        });
    });

    it('returns fresh requirement objects for settings UI callers', () => {
        const report = createBrowserEditorReadinessReport({
            browserFileSystemAccess: true,
            runtime: 'desktop',
        });
        report.requirements[0].summary = 'mutated';

        expect(createBrowserEditorReadinessReport({
            browserFileSystemAccess: true,
            runtime: 'desktop',
        }).requirements[0].summary).toBe('The editor can run as a browser app.');
    });
});

import { describe, expect, it } from 'vitest';

import { createDesktopCapabilityPrivacyReadinessReport } from '../desktopCapabilityPrivacyReadiness';

describe('desktopCapabilityPrivacyReadiness', () => {
    it('reports the current editor desktop posture as limited and source-reviewable', () => {
        const report = createDesktopCapabilityPrivacyReadinessReport();

        expect(report.status).toBe('limited');
        expect(report.ready).toBe(2);
        expect(report.limited).toBe(5);
        expect(report.blocked).toBe(0);
        expect(report.requirements.map((requirement) => [requirement.id, requirement.status])).toEqual([
            ['authoringFileAccess', 'ready'],
            ['broadFilesystemScope', 'limited'],
            ['broadOpenPathScope', 'limited'],
            ['broadAssetProtocol', 'limited'],
            ['nativeCommandSurface', 'limited'],
            ['localConsoleCapture', 'limited'],
            ['packagedGameBoundary', 'ready'],
        ]);
    });

    it('calls out local console output as useful but not share-safe', () => {
        const requirement = createDesktopCapabilityPrivacyReadinessReport()
            .requirements
            .find((entry) => entry.id === 'localConsoleCapture');

        expect(requirement).toMatchObject({
            status: 'limited',
            summary: 'Logs stay local but may include local paths or command output.',
        });
        expect(requirement?.detail).toContain('not intended as share-safe telemetry');
    });

    it('returns fresh requirement objects for future UI or command callers', () => {
        const report = createDesktopCapabilityPrivacyReadinessReport();
        report.requirements[0].summary = 'mutated';

        expect(createDesktopCapabilityPrivacyReadinessReport().requirements[0].summary)
            .toBe('Desktop project authoring has an explicit local-file purpose.');
    });
});

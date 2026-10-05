import { describe, expect, it } from 'vitest';

import { createDesktopPackagingReadinessReport } from '../desktopPackagingReadiness';

describe('desktopPackagingReadiness', () => {
    it('reports the standalone game shell and package command as available', () => {
        const report = createDesktopPackagingReadinessReport();

        expect(report.status).toBe('ready');
        expect(report.ready).toBe(5);
        expect(report.blocked).toBe(0);
        expect(report.requirements.map((requirement) => [requirement.id, requirement.status])).toEqual([
            ['exportArtifactContract', 'ready'],
            ['runtimeSmokeGate', 'ready'],
            ['separatePlayerShell', 'ready'],
            ['scopedGamePermissions', 'ready'],
            ['packagingCommand', 'ready'],
        ]);
    });

    it('returns fresh requirement objects for UI callers', () => {
        const report = createDesktopPackagingReadinessReport();
        report.requirements[0].summary = 'mutated';

        expect(createDesktopPackagingReadinessReport().requirements[0].summary)
            .toBe('Loose player exports already produce comparable runtime artifacts.');
    });
});

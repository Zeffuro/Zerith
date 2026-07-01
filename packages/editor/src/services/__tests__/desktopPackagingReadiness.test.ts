import { describe, expect, it } from 'vitest';

import { createDesktopPackagingReadinessReport } from '../desktopPackagingReadiness';

describe('desktopPackagingReadiness', () => {
    it('keeps packaged desktop game export blocked until shell and permission requirements exist', () => {
        const report = createDesktopPackagingReadinessReport();

        expect(report.status).toBe('blocked');
        expect(report.ready).toBe(2);
        expect(report.blocked).toBe(3);
        expect(report.requirements.map((requirement) => [requirement.id, requirement.status])).toEqual([
            ['exportArtifactContract', 'ready'],
            ['runtimeSmokeGate', 'ready'],
            ['separatePlayerShell', 'blocked'],
            ['scopedGamePermissions', 'blocked'],
            ['packagingCommand', 'blocked'],
        ]);
    });

    it('returns fresh requirement objects for UI callers', () => {
        const report = createDesktopPackagingReadinessReport();
        report.requirements[0].summary = 'mutated';

        expect(createDesktopPackagingReadinessReport().requirements[0].summary)
            .toBe('Loose player exports already produce comparable runtime artifacts.');
    });
});

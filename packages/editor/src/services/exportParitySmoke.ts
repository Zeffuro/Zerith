import type {
    BrowserDesktopExportArtifactComparison,
    BrowserDesktopExportArtifactStatus,
} from './browserParityReport';
import type { ExportGameResult } from './exportGame';

import { compareBrowserDesktopExportArtifacts } from './browserParityReport';

export type BrowserDesktopExportRunSmokeComparison =
    | {
        artifactComparison: BrowserDesktopExportArtifactComparison;
        browserStdout: string;
        desktopStdout: string;
        status: 'matched' | 'mismatched';
    }
    | {
        browserStdout: string;
        desktopStdout: string;
        reasons: string[];
        status: 'blocked';
    };

export function compareBrowserDesktopExportRuns(
    browserResult: ExportGameResult,
    desktopResult: ExportGameResult,
): BrowserDesktopExportRunSmokeComparison {
    const reasons: string[] = [];
    const browserArtifact = browserResult.artifactManifest;
    const desktopArtifact = desktopResult.artifactManifest;

    if (!browserArtifact) {
        reasons.push('Browser export result did not include an artifact manifest.');
    }

    if (!desktopArtifact) {
        reasons.push('Desktop export result did not include an artifact manifest.');
    }

    if (!browserArtifact || !desktopArtifact) {
        return {
            browserStdout: browserResult.stdout,
            desktopStdout: desktopResult.stdout,
            reasons,
            status: 'blocked',
        };
    }

    const artifactComparison = compareBrowserDesktopExportArtifacts(
        browserArtifact,
        desktopArtifact,
    );

    return {
        artifactComparison,
        browserStdout: browserResult.stdout,
        desktopStdout: desktopResult.stdout,
        status: hasOnlyMatchedChecks(artifactComparison.summary) ? 'matched' : 'mismatched',
    };
}

function hasOnlyMatchedChecks(summary: Record<BrowserDesktopExportArtifactStatus, number>): boolean {
    return summary.matched > 0 && summary.mismatched === 0 && summary.missing === 0;
}

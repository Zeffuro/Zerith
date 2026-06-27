import { executeConsoleMessageAction } from '../store/actions/consoleMessageActions';
import {
    createProjectValidationReport,
    type ProjectValidationReport,
} from './projectValidationReport';

export type ProjectValidationCommandDependencies = {
    buildReport: typeof createProjectValidationReport;
    log: typeof executeConsoleMessageAction;
};

export type ProjectValidationCommandResult =
    | { error: unknown; status: 'failed' }
    | { report: ProjectValidationReport; status: 'issues' | 'ok' }
    | { status: 'no-project' };

const defaultDependencies: ProjectValidationCommandDependencies = {
    buildReport: createProjectValidationReport,
    log: executeConsoleMessageAction,
};

export async function executeProjectValidationCommand(
    projectPath: string | undefined,
    dependencies: ProjectValidationCommandDependencies = defaultDependencies,
): Promise<ProjectValidationCommandResult> {
    if (!projectPath) {
        dependencies.log('editor', 'warn', 'Project validation requires an open project.');
        return { status: 'no-project' };
    }

    try {
        const report = await dependencies.buildReport(projectPath);
        const summary = summarizeProjectValidationReport(report);
        const status = summary.hasIssues ? 'issues' : 'ok';

        dependencies.log('editor', status === 'issues' ? 'warn' : 'info', formatProjectValidationReport(report));
        return { report, status };
    } catch (error) {
        dependencies.log('editor', 'error', 'Project validation failed:', error);
        return { error, status: 'failed' };
    }
}

export function formatProjectValidationReport(report: ProjectValidationReport): string {
    const summary = summarizeProjectValidationReport(report);
    const lines = [
        `Project validation: ${summary.hasIssues ? 'issues found' : 'clean'}`,
        `Scenes: ${report.scenes.length}; graph issues: ${summary.graphIssues}; reachable: ${report.graph.reachableScenes.length}; unreachable: ${report.graph.unreachableScenes.length}`,
        `Localization: ${report.localization.referenceCount} references; missing: ${summary.missingLocaleEntries}; unused: ${summary.unusedLocaleEntries}; invalid bundles: ${summary.invalidLocaleBundles}`,
        `Backlog: ${report.backlog.visibleCount} visible lines; hidden: ${report.backlog.hiddenCount}; voiced: ${report.backlog.voicedCount}; missing line IDs: ${report.backlog.missingLineIds.length}; duplicate line IDs: ${report.backlog.duplicateLineIds.length}`,
    ];

    for (const issue of report.graph.issues.slice(0, 8)) {
        lines.push(`- Graph ${issue.code}: ${issue.message}`);
    }

    for (const localeReport of report.localization.localeReports) {
        if (localeReport.status === 'invalid') {
            lines.push(`- Locale ${localeReport.locale}: ${localeReport.error}`);
            continue;
        }

        for (const missing of localeReport.missing.slice(0, 6)) {
            lines.push(`- Locale ${localeReport.locale} missing ${missing.namespace ?? '*'}:${missing.lineId} (${missing.sceneName} @ ${missing.path.join('.')})`);
        }

        for (const unused of localeReport.unused.slice(0, 4)) {
            lines.push(`- Locale ${localeReport.locale} unused ${unused.namespace}:${unused.lineId}`);
        }
    }

    for (const entry of report.backlog.missingLineIds.slice(0, 6)) {
        lines.push(`- Backlog line missing lineId: ${entry.sceneName ?? 'unknown'} @ ${entry.path.join('.')} (${entry.speaker})`);
    }

    for (const duplicate of report.backlog.duplicateLineIds.slice(0, 6)) {
        lines.push(`- Backlog duplicate lineId ${duplicate.namespace ?? '*'}:${duplicate.lineId} (${duplicate.entries.length} lines)`);
    }

    return lines.join('\n');
}

function summarizeProjectValidationReport(report: ProjectValidationReport): {
    graphIssues: number;
    hasIssues: boolean;
    invalidLocaleBundles: number;
    missingLocaleEntries: number;
    unusedLocaleEntries: number;
} {
    let missingLocaleEntries = 0;
    let unusedLocaleEntries = 0;

    for (const localeReport of report.localization.localeReports) {
        if (localeReport.status !== 'ok') continue;
        missingLocaleEntries += localeReport.missing.length;
        unusedLocaleEntries += localeReport.unused.length;
    }

    const invalidLocaleBundles = report.localization.localeReports
        .filter((localeReport) => localeReport.status === 'invalid')
        .length;
    const graphIssues = report.graph.issues.length;
    const hasIssues = graphIssues > 0
        || missingLocaleEntries > 0
        || unusedLocaleEntries > 0
        || invalidLocaleBundles > 0
        || report.backlog.missingLineIds.length > 0
        || report.backlog.duplicateLineIds.length > 0;

    return {
        graphIssues,
        hasIssues,
        invalidLocaleBundles,
        missingLocaleEntries,
        unusedLocaleEntries,
    };
}

import type { DialogueBacklogEntry } from '@zeffuro/zerith-core/types';

import type {
    ProjectValidationLocaleReport,
    ProjectValidationReport,
} from '../../services/projectValidationReport';

export type ProjectValidationPanelAction = {
    kind: 'localization';
    label: string;
    locale?: string;
    namespace?: string;
    query: string;
    status?: 'missing' | 'unused';
    title: string;
};

export type ProjectValidationPanelRow = {
    actions?: ProjectValidationPanelAction[];
    category: 'Backlog' | 'Graph' | 'Localization';
    detail: string;
    id: string;
    severity: 'error' | 'warning';
    source?: ProjectValidationPanelSource;
    title: string;
};

export type ProjectValidationPanelSource = {
    filePath: string;
    jsonPath?: string[];
    path?: number[];
};

export type ProjectValidationPanelSummary = {
    duplicateLineIds: number;
    graphIssues: number;
    invalidLocaleBundles: number;
    issueRows: number;
    missingLineIds: number;
    missingLocaleEntries: number;
    scenes: number;
    unusedLocaleEntries: number;
};

export function buildProjectValidationPanelRows(report: ProjectValidationReport): ProjectValidationPanelRow[] {
    return [
        ...buildGraphRows(report),
        ...buildLocalizationRows(report),
        ...buildBacklogRows(report),
    ];
}

export function summarizeProjectValidationPanelReport(report: ProjectValidationReport): ProjectValidationPanelSummary {
    const rows = buildProjectValidationPanelRows(report);
    let missingLocaleEntries = 0;
    let unusedLocaleEntries = 0;
    let invalidLocaleBundles = 0;

    for (const localeReport of report.localization.localeReports) {
        if (localeReport.status === 'invalid') {
            invalidLocaleBundles++;
            continue;
        }

        missingLocaleEntries += localeReport.missing.length;
        unusedLocaleEntries += localeReport.unused.length;
    }

    return {
        duplicateLineIds: report.backlog.duplicateLineIds.length,
        graphIssues: report.graph.issues.length,
        invalidLocaleBundles,
        issueRows: rows.length,
        missingLineIds: report.backlog.missingLineIds.length,
        missingLocaleEntries,
        scenes: report.scenes.length,
        unusedLocaleEntries,
    };
}

function buildBacklogRows(report: ProjectValidationReport): ProjectValidationPanelRow[] {
    const missingRows = report.backlog.missingLineIds.map((entry, index) => ({
        category: 'Backlog' as const,
        detail: `${entry.sceneName ?? 'unknown scene'} @ ${formatCommandPath(entry.path)} (${entry.speaker})`,
        id: `backlog-missing-${index}`,
        severity: 'error' as const,
        source: sourceFromBacklogEntry(report, entry),
        title: 'Dialogue line is missing a lineId',
    }));

    const duplicateRows = report.backlog.duplicateLineIds.map((duplicate, index) => {
        const firstEntry = duplicate.entries[0];
        return {
            category: 'Backlog' as const,
            detail: `${duplicate.namespace ?? '*'}:${duplicate.lineId} appears ${duplicate.entries.length} times`,
            id: `backlog-duplicate-${index}`,
            severity: 'error' as const,
            source: firstEntry ? sourceFromBacklogEntry(report, firstEntry) : undefined,
            title: 'Duplicate dialogue lineId',
        };
    });

    return [...missingRows, ...duplicateRows];
}

function buildGraphRows(report: ProjectValidationReport): ProjectValidationPanelRow[] {
    return report.graph.issues.map((issue, index) => {
        if (issue.code === 'missing_start_scene') {
            return {
                category: 'Graph',
                detail: issue.message,
                id: `graph-${issue.code}-${index}`,
                severity: 'error',
                source: { filePath: report.manifestPath, jsonPath: ['startScene'] },
                title: `Missing start scene: ${issue.targetScene}`,
            };
        }

        if (issue.code === 'unreachable_scene') {
            return {
                category: 'Graph',
                detail: issue.message,
                id: `graph-${issue.code}-${index}`,
                severity: 'warning',
                source: sourceFromScene(report, issue.sceneName),
                title: `Unreachable scene: ${issue.sceneName}`,
            };
        }

        return {
            category: 'Graph',
            detail: `${issue.message} @ ${formatCommandPath(issue.path)}`,
            id: `graph-${issue.code}-${index}`,
            severity: 'error',
            source: sourceFromScene(report, issue.sceneName, issue.path),
            title: formatGraphIssueTitle(issue),
        };
    });
}

function buildLocalizationRows(report: ProjectValidationReport): ProjectValidationPanelRow[] {
    return report.localization.localeReports.flatMap<ProjectValidationPanelRow>((localeReport) => {
        if (localeReport.status === 'invalid') {
            return [{
                category: 'Localization' as const,
                detail: localeReport.error,
                id: `locale-invalid-${localeReport.locale}`,
                severity: 'error' as const,
                source: sourceFromLocaleReport(report, localeReport),
                title: `Invalid locale bundle: ${localeReport.locale}`,
            }];
        }

        return [
            ...localeReport.missing.map((missing, index) => ({
                actions: [localizationAction(localeReport.locale, missing.namespace, missing.lineId, 'missing')],
                category: 'Localization' as const,
                detail: `${missing.sceneName} @ ${formatCommandPath(missing.path)}`,
                id: `locale-missing-${localeReport.locale}-${index}`,
                severity: 'error' as const,
                source: sourceFromScene(report, missing.sceneName, missing.path),
                title: `Missing ${localeReport.locale} text: ${missing.namespace ?? '*'}:${missing.lineId}`,
            })),
            ...localeReport.unused.map((unused, index) => ({
                actions: [localizationAction(localeReport.locale, unused.namespace, unused.lineId, 'unused')],
                category: 'Localization' as const,
                detail: `${unused.namespace}:${unused.lineId}`,
                id: `locale-unused-${localeReport.locale}-${index}`,
                severity: 'warning' as const,
                source: sourceFromLocaleEntry(report, localeReport, unused.namespace, unused.lineId),
                title: `Unused ${localeReport.locale} text`,
            })),
        ];
    });
}

function formatCommandPath(path: number[] | undefined): string {
    return path && path.length > 0 ? path.join('.') : 'scene';
}

function formatGraphIssueTitle(issue: Exclude<ProjectValidationReport['graph']['issues'][number], { code: 'missing_start_scene' | 'unreachable_scene' }>): string {
    if (issue.code === 'duplicate_label') return `Duplicate label: ${issue.label}`;
    if (issue.code === 'missing_label') return `Missing label: ${issue.label}`;
    return `Missing scene: ${issue.targetScene}`;
}

function localizationAction(
    locale: string,
    namespace: string | undefined,
    lineId: string,
    status: 'missing' | 'unused',
): ProjectValidationPanelAction {
    return {
        kind: 'localization',
        label: 'Locale',
        locale,
        namespace,
        query: namespace ? `${namespace}:${lineId}` : lineId,
        status,
        title: 'Open in localization editor',
    };
}

function sourceFromBacklogEntry(
    report: ProjectValidationReport,
    entry: DialogueBacklogEntry,
): ProjectValidationPanelSource | undefined {
    return entry.sceneName ? sourceFromScene(report, entry.sceneName, entry.path) : undefined;
}

function sourceFromLocaleEntry(
    report: ProjectValidationReport,
    localeReport: ProjectValidationLocaleReport,
    namespace: string,
    lineId: string,
): ProjectValidationPanelSource {
    return {
        filePath: localeReport.path ?? report.manifestPath,
        jsonPath: localeReport.path
            ? ['namespaces', namespace, lineId]
            : ['localization', 'locales', localeReport.locale, 'namespaces', namespace, lineId],
    };
}

function sourceFromLocaleReport(
    report: ProjectValidationReport,
    localeReport: ProjectValidationLocaleReport,
): ProjectValidationPanelSource {
    return {
        filePath: localeReport.path ?? report.manifestPath,
        jsonPath: localeReport.path ? ['namespaces'] : ['localization', 'locales', localeReport.locale],
    };
}

function sourceFromScene(
    report: ProjectValidationReport,
    sceneName: string,
    path?: number[],
): ProjectValidationPanelSource {
    const scene = report.scenes.find((entry) => entry.sceneName === sceneName);
    if (!scene?.path) {
        return {
            filePath: report.manifestPath,
            jsonPath: ['scenes', sceneName],
        };
    }

    return {
        filePath: scene.path,
        path,
    };
}

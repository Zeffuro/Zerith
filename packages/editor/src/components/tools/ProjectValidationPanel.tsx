import type { CSSProperties } from 'react';

import { AlertTriangle, CheckCircle2, ExternalLink, Languages, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { ProjectValidationReport } from '../../services/projectValidationReport';
import type { ScriptPath } from '../../utils/scriptPathUtilities';
import type {
    ProjectValidationPanelRow,
    ProjectValidationPanelSource,
} from './projectValidationPanelModel';

import { openLocalizationWorkbenchTab } from '../../services/localizationWorkbench';
import { openProjectEntry } from '../../services/openProjectEntry';
import { executeProjectValidationCommand } from '../../services/projectValidationCommand';
import { useProjectStore } from '../../store/storeBootstrap';
import { useEditorStore } from '../../store/useEditorStore';
import { editorTheme as t } from '../../theme/editorTheme';
import { DOCK_PANELS } from '../layout/dock/dockPanelIds';
import {
    buildProjectValidationPanelRows,
    summarizeProjectValidationPanelReport,
} from './projectValidationPanelModel';

type ValidationRunState = 'error' | 'idle' | 'issues' | 'ok' | 'running';

export function ProjectValidationPanel() {
    const projectPath = useProjectStore((state) => state.projectPath);
    const dirtyFiles = useProjectStore((state) => state.dirtyFiles);
    const saveAllDirtyFiles = useProjectStore((state) => state.saveAllDirtyFiles);
    const markManualSave = useEditorStore((state) => state.markManualSave);
    const uiScale = useEditorStore((state) => state.uiScale);

    const [errorMessage, setErrorMessage] = useState<string | undefined>();
    const [query, setQuery] = useState('');
    const [report, setReport] = useState<ProjectValidationReport>();
    const [runState, setRunState] = useState<ValidationRunState>('idle');

    useEffect(() => {
        setErrorMessage(undefined);
        setQuery('');
        setReport(undefined);
        setRunState('idle');
    }, [projectPath]);

    const rows = useMemo(
        () => report ? buildProjectValidationPanelRows(report) : [],
        [report],
    );
    const filteredRows = useMemo(
        () => filterRows(rows, query),
        [query, rows],
    );
    const summary = useMemo(
        () => report ? summarizeProjectValidationPanelReport(report) : undefined,
        [report],
    );

    const runValidation = async () => {
        if (!projectPath || runState === 'running') return;

        setErrorMessage(undefined);
        setRunState('running');

        try {
            if (dirtyFiles.size > 0) {
                markManualSave();
                const saveResult = await saveAllDirtyFiles();
                const remainingDirtyCount = useProjectStore.getState().dirtyFiles.size;
                if (saveResult.failed.length > 0 || remainingDirtyCount > 0) {
                    setRunState('error');
                    setErrorMessage('Validation cancelled because not all dirty files could be saved.');
                    return;
                }
            }

            const result = await executeProjectValidationCommand(projectPath);
            if (result.status === 'failed') {
                setRunState('error');
                setErrorMessage(result.error instanceof Error ? result.error.message : String(result.error));
                return;
            }

            if (result.status === 'no-project') {
                setRunState('idle');
                return;
            }

            setReport(result.report);
            setRunState(result.status);
        } catch (error) {
            setRunState('error');
            setErrorMessage(error instanceof Error ? error.message : String(error));
        }
    };

    if (!projectPath) {
        return <EmptyPanelMessage message="Open a project to validate content." uiScale={uiScale} />;
    }

    return (
        <div
            className="zerith-scrollbar"
            style={{
                background: t.bg.app,
                color: t.text.normal,
                display: 'flex',
                flexDirection: 'column',
                gap: `${8 * uiScale}px`,
                height: '100%',
                overflow: 'auto',
                padding: `${10 * uiScale}px`,
            }}
        >
            <div style={headerRowStyle(uiScale)}>
                <strong>Project Validation</strong>
                <button
                    className="toolbar-btn"
                    disabled={runState === 'running'}
                    onClick={() => {
                        void runValidation();
                    }}
                    style={runButtonStyle(uiScale, runState === 'running')}
                    type="button"
                >
                    <RefreshCw size={14 * uiScale} />
                    <span>{runState === 'running' ? 'Validating...' : 'Validate'}</span>
                </button>
            </div>

            {summary ? (
                <div style={summaryGridStyle(uiScale)}>
                    <SummaryChip label="Scenes" uiScale={uiScale} value={summary.scenes} />
                    <SummaryChip label="Issues" tone={summary.issueRows > 0 ? 'bad' : 'good'} uiScale={uiScale} value={summary.issueRows} />
                    <SummaryChip label="Graph" uiScale={uiScale} value={summary.graphIssues} />
                    <SummaryChip label="Locale" uiScale={uiScale} value={summary.missingLocaleEntries + summary.unusedLocaleEntries + summary.invalidLocaleBundles} />
                    <SummaryChip label="Backlog" uiScale={uiScale} value={summary.missingLineIds + summary.duplicateLineIds} />
                </div>
            ) : (
                <div style={{ color: t.text.faint, fontStyle: 'italic' }}>Validation has not run yet.</div>
            )}

            {errorMessage ? (
                <div style={errorStyle(uiScale)}>{errorMessage}</div>
            ) : undefined}

            {report ? (
                <input
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Filter validation rows..."
                    style={inputStyle(uiScale)}
                    value={query}
                />
            ) : undefined}

            {runState === 'ok' && rows.length === 0 ? (
                <div style={cleanStateStyle(uiScale)}>
                    <CheckCircle2 size={16 * uiScale} />
                    <span>No validation issues found.</span>
                </div>
            ) : undefined}

            {report && filteredRows.length === 0 && rows.length > 0 ? (
                <div style={{ color: t.text.faint, fontStyle: 'italic' }}>No rows match the filter.</div>
            ) : undefined}

            {filteredRows.map((row) => (
                <ValidationRow key={row.id} row={row} uiScale={uiScale} />
            ))}
        </div>
    );
}

function basename(path: string): string {
    return path.split(/[\\/]/).pop() || path;
}

function categoryBadgeStyle(uiScale: number): CSSProperties {
    return {
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.sm,
        color: t.text.faint,
        flex: '0 0 auto',
        fontSize: `${10 * uiScale}px`,
        padding: `${1 * uiScale}px ${5 * uiScale}px`,
    };
}

function cleanStateStyle(uiScale: number): CSSProperties {
    return {
        alignItems: 'center',
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.md,
        color: t.accent.green,
        display: 'flex',
        gap: `${6 * uiScale}px`,
        padding: `${8 * uiScale}px`,
    };
}

function EmptyPanelMessage({ message, uiScale }: { message: string; uiScale: number }) {
    return (
        <div style={{ color: t.text.faint, fontStyle: 'italic', padding: `${12 * uiScale}px` }}>
            {message}
        </div>
    );
}

function errorStyle(uiScale: number): CSSProperties {
    return {
        border: `1px solid ${t.accent.red}`,
        borderRadius: t.radius.md,
        color: t.accent.red,
        padding: `${8 * uiScale}px`,
    };
}

function filterRows(rows: ProjectValidationPanelRow[], query: string): ProjectValidationPanelRow[] {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return rows;

    return rows.filter((row) => (
        row.category.toLowerCase().includes(normalizedQuery)
        || row.detail.toLowerCase().includes(normalizedQuery)
        || row.source?.filePath.toLowerCase().includes(normalizedQuery)
        || row.source?.jsonPath?.join('.').toLowerCase().includes(normalizedQuery)
        || row.title.toLowerCase().includes(normalizedQuery)
    ));
}

function headerRowStyle(uiScale: number): CSSProperties {
    return {
        alignItems: 'center',
        display: 'flex',
        gap: `${8 * uiScale}px`,
        justifyContent: 'space-between',
    };
}

function inputStyle(uiScale: number): CSSProperties {
    return {
        background: t.bg.input,
        border: `1px solid ${t.border.input}`,
        borderRadius: t.radius.sm,
        color: t.text.primary,
        fontSize: `${12 * uiScale}px`,
        outline: 'none',
        padding: `${6 * uiScale}px ${8 * uiScale}px`,
    };
}

async function openSource(source: ProjectValidationPanelSource): Promise<void> {
    await openProjectEntry(source.filePath, basename(source.filePath), {
        forceView: source.path ? 'timeline' : (source.jsonPath ? 'json' : undefined),
        jsonSelectionPath: source.jsonPath,
    });

    if (source.path) {
        const path = source.path as ScriptPath;
        const editor = useEditorStore.getState();
        editor.setSelectedNodePaths([path]);
        editor.setSelectionAnchorPath(path);
    }

    if (typeof globalThis.dispatchEvent === 'function' && typeof globalThis.CustomEvent === 'function') {
        globalThis.dispatchEvent(new globalThis.CustomEvent('zerith:dock-select', { detail: DOCK_PANELS.editor }));
    }
}

function rowActionButtonStyle(uiScale: number): CSSProperties {
    return {
        alignItems: 'center',
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.sm,
        color: t.text.muted,
        display: 'inline-flex',
        fontSize: `${11 * uiScale}px`,
        gap: `${4 * uiScale}px`,
        justifyContent: 'center',
        padding: `${4 * uiScale}px ${6 * uiScale}px`,
        whiteSpace: 'nowrap',
    };
}

function rowActionsStyle(uiScale: number): CSSProperties {
    return {
        alignItems: 'center',
        display: 'flex',
        flexWrap: 'wrap',
        gap: `${5 * uiScale}px`,
        justifyContent: 'end',
    };
}

function rowStyle(uiScale: number): CSSProperties {
    return {
        alignItems: 'center',
        background: t.bg.panel,
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.sm,
        display: 'grid',
        gap: `${8 * uiScale}px`,
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        padding: `${7 * uiScale}px ${8 * uiScale}px`,
    };
}

function runButtonStyle(uiScale: number, disabled: boolean): CSSProperties {
    return {
        alignItems: 'center',
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.sm,
        color: disabled ? t.text.faint : t.text.primary,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        gap: `${6 * uiScale}px`,
        padding: `${5 * uiScale}px ${8 * uiScale}px`,
    };
}

function SummaryChip({
    label,
    tone,
    uiScale,
    value,
}: {
    label: string;
    tone?: 'bad' | 'good';
    uiScale: number;
    value: number;
}) {
    const color = tone === 'bad'
        ? t.accent.red
        : (tone === 'good' ? t.accent.green : t.text.normal);

    return (
        <div style={summaryChipStyle(uiScale)}>
            <span style={{ color: t.text.faint }}>{label}</span>
            <strong style={{ color }}>{value}</strong>
        </div>
    );
}

function summaryChipStyle(uiScale: number): CSSProperties {
    return {
        background: t.bg.panel,
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.sm,
        display: 'grid',
        gap: `${2 * uiScale}px`,
        minWidth: `${72 * uiScale}px`,
        padding: `${6 * uiScale}px ${8 * uiScale}px`,
    };
}

function summaryGridStyle(uiScale: number): CSSProperties {
    return {
        display: 'grid',
        gap: `${6 * uiScale}px`,
        gridTemplateColumns: 'repeat(auto-fit, minmax(72px, 1fr))',
    };
}

function ValidationRow({ row, uiScale }: { row: ProjectValidationPanelRow; uiScale: number }) {
    const color = row.severity === 'error' ? t.accent.red : t.accent.yellow;
    const content = (
        <span style={{ display: 'grid', gap: `${3 * uiScale}px`, minWidth: 0 }}>
            <div style={{ alignItems: 'center', display: 'flex', gap: `${6 * uiScale}px`, minWidth: 0 }}>
                <AlertTriangle color={color} size={14 * uiScale} />
                <span style={{ color: t.text.primary, fontWeight: 700, overflowWrap: 'anywhere' }}>{row.title}</span>
                <span style={categoryBadgeStyle(uiScale)}>{row.category}</span>
            </div>
            <div style={{ color: t.text.muted, fontSize: `${11 * uiScale}px`, overflowWrap: 'anywhere' }}>
                {row.detail}
            </div>
        </span>
    );
    const actions = row.source || row.actions?.length ? (
        <span style={rowActionsStyle(uiScale)}>
            {row.source ? (
                <button
                    className="toolbar-btn"
                    onClick={() => {
                        void openSource(row.source!);
                    }}
                    style={rowActionButtonStyle(uiScale)}
                    title="Open source"
                    type="button"
                >
                    <ExternalLink size={12 * uiScale} />
                    <span>Source</span>
                </button>
            ) : undefined}
            {row.actions?.map((action) => (
                <button
                    className="toolbar-btn"
                    key={`${action.kind}-${action.query}`}
                    onClick={() => {
                        if (action.kind === 'localization') openLocalizationWorkbenchTab({ query: action.query });
                    }}
                    style={rowActionButtonStyle(uiScale)}
                    title={action.title}
                    type="button"
                >
                    <Languages size={12 * uiScale} />
                    <span>{action.label}</span>
                </button>
            ))}
        </span>
    ) : undefined;

    return (
        <div style={rowStyle(uiScale)}>
            {content}
            {actions}
        </div>
    );
}

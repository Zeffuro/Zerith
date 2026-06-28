import type { WorkbenchTab } from '../../../store/workbench/types';

import { editorTheme as t } from '../../../theme/editorTheme';
import { buildGitDiffLines, type GitDiffLineKind } from './gitDiffViewerModel';

export function GitDiffViewer({ tab, uiScale }: { tab: WorkbenchTab; uiScale: number; }) {
    const lines = buildGitDiffLines(tab.textContent);
    const filePath = tab.gitDiffFilePath ?? tab.title.replace(/^Diff:\s*/u, '');

    return (
        <div style={containerStyle()}>
            <div style={headerStyle(uiScale)}>
                <strong>{filePath}</strong>
                {tab.gitDiffRepositoryRoot ? <span>{tab.gitDiffRepositoryRoot}</span> : undefined}
            </div>
            {lines.length > 0 ? (
                <pre className="zerith-scrollbar" style={preStyle(uiScale)}>
                    {lines.map((line) => (
                        <div key={`${line.lineNumber}-${line.text}`} style={lineStyle(line.kind, uiScale)}>
                            <span style={lineNumberStyle(uiScale)}>{line.lineNumber}</span>
                            <span>{line.text || ' '}</span>
                        </div>
                    ))}
                </pre>
            ) : (
                <div style={emptyStateStyle(uiScale)}>No textual diff available for {filePath}.</div>
            )}
        </div>
    );
}

function containerStyle() {
    return {
        background: t.bg.app,
        color: t.text.normal,
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
    };
}

function emptyStateStyle(uiScale: number) {
    return {
        color: t.text.faint,
        fontSize: `${12 * uiScale}px`,
        padding: `${14 * uiScale}px`,
    };
}

function headerStyle(uiScale: number) {
    return {
        alignItems: 'center',
        background: t.bg.panel,
        borderBottom: `1px solid ${t.border.subtle}`,
        color: t.text.normal,
        display: 'flex',
        fontSize: `${12 * uiScale}px`,
        gap: `${10 * uiScale}px`,
        minHeight: `${34 * uiScale}px`,
        overflow: 'hidden',
        padding: `${7 * uiScale}px ${10 * uiScale}px`,
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap' as const,
    };
}

function lineNumberStyle(uiScale: number) {
    return {
        color: t.text.faint,
        display: 'inline-block',
        minWidth: `${42 * uiScale}px`,
        paddingRight: `${10 * uiScale}px`,
        textAlign: 'right' as const,
        userSelect: 'none' as const,
    };
}

function lineStyle(kind: GitDiffLineKind, uiScale: number) {
    const colors: Record<GitDiffLineKind, { background: string; border: string; color: string; }> = {
        addition: {
            background: 'color-mix(in srgb, var(--editor-accent-green) 14%, transparent)',
            border: t.accent.green,
            color: t.accent.green,
        },
        blank: {
            background: 'transparent',
            border: 'transparent',
            color: t.text.normal,
        },
        context: {
            background: 'transparent',
            border: 'transparent',
            color: t.text.normal,
        },
        deletion: {
            background: 'color-mix(in srgb, var(--editor-accent-red) 14%, transparent)',
            border: t.accent.red,
            color: t.accent.red,
        },
        file: {
            background: t.bg.panelAlt,
            border: t.border.subtle,
            color: t.text.primary,
        },
        hunk: {
            background: t.bg.selected,
            border: t.accent.primary,
            color: t.text.primary,
        },
        meta: {
            background: 'transparent',
            border: 'transparent',
            color: t.text.faint,
        },
    };
    const palette = colors[kind];

    return {
        background: palette.background,
        borderLeft: `${3 * uiScale}px solid ${palette.border}`,
        color: palette.color,
        display: 'block',
        minHeight: `${18 * uiScale}px`,
        padding: `${1 * uiScale}px ${8 * uiScale}px ${1 * uiScale}px ${4 * uiScale}px`,
        whiteSpace: 'pre' as const,
    };
}

function preStyle(uiScale: number) {
    return {
        fontFamily: 'ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
        fontSize: `${11 * uiScale}px`,
        lineHeight: 1.45,
        margin: 0,
        minHeight: 0,
        overflow: 'auto',
        padding: `${8 * uiScale}px 0`,
    };
}

import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';

import type { GitStatusEntry } from '../../services/gitIntegration';

import { editorTheme as t } from '../../theme/editorTheme';
import {
    changeGroupHeaderStyle,
    changeGroupStyle,
    changeRowStyle,
    emptyStateStyle,
    fileRowStyle,
    rowActionButtonStyle,
} from './gitPanelStyles';
import { formatGitStatusCode } from './gitPanelModel';

export function GitPanelChangeGroup({
    actionLabel,
    actionTitle,
    entries,
    emptyLabel,
    icon,
    isBusy,
    isLoadingDiff,
    limit,
    onAction,
    onSelect,
    selectedDiffPath,
    title,
    uiScale,
}: {
    actionLabel: string;
    actionTitle: string;
    entries: GitStatusEntry[];
    emptyLabel: string;
    icon: 'stage' | 'unstage';
    isBusy: boolean;
    isLoadingDiff: boolean;
    limit: number;
    onAction: (path: string) => void;
    onSelect: (path: string) => Promise<void>;
    selectedDiffPath: string | undefined;
    title: string;
    uiScale: number;
}) {
    const visibleEntries = entries.slice(0, limit);
    const Icon = icon === 'stage' ? ArrowUpFromLine : ArrowDownToLine;

    return (
        <div style={changeGroupStyle(uiScale)}>
            <div style={changeGroupHeaderStyle(uiScale)}>
                <span>{title}</span>
            </div>
            {visibleEntries.length > 0 ? (
                visibleEntries.map((entry) => (
                    <div key={`${title}-${entry.path}-${entry.index}-${entry.workingTree}`} style={changeRowStyle(uiScale)}>
                        <button
                            className="toolbar-btn"
                            disabled={isLoadingDiff}
                            onClick={() => {
                                void onSelect(entry.path);
                            }}
                            style={fileRowStyle(uiScale, selectedDiffPath === entry.path, isLoadingDiff)}
                            title={`Show diff for ${entry.path}`}
                            type="button"
                        >
                            <span style={{ color: t.text.primary, fontFamily: 'monospace' }}>{formatGitStatusCode(entry)}</span>
                            <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{entry.path}</span>
                        </button>
                        <button
                            className="toolbar-btn"
                            disabled={isBusy}
                            onClick={() => onAction(entry.path)}
                            style={rowActionButtonStyle(uiScale, isBusy)}
                            title={`${actionTitle}: ${entry.path}`}
                            type="button"
                        >
                            <Icon size={11 * uiScale} />
                            <span>{actionLabel}</span>
                        </button>
                    </div>
                ))
            ) : (
                <div style={emptyStateStyle(uiScale)}>{emptyLabel}</div>
            )}
            {entries.length > limit ? (
                <div style={emptyStateStyle(uiScale)}>{entries.length - limit} more file(s).</div>
            ) : undefined}
        </div>
    );
}

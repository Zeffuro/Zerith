import * as React from 'react';
import { AlertTriangle, Play, Trash2, ChevronRight, ChevronDown, FolderTree } from 'lucide-react';
import type { ScriptPath } from '../../../utils/scriptPathUtils';
import { getPlugin } from '../../../editor/commandPlugins';
import { editorTheme as t } from '../../../theme/editorTheme';

function escapeRegExp(input: string) {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightText(text: string, query: string, uiScale: number) {
    const q = query.trim();
    if (!q) return text;

    const re = new RegExp(`(${escapeRegExp(q)})`, 'ig');
    const parts = text.split(re);

    return (
        <>
            {parts.map((part, i) => {
                const isMatch = part.toLowerCase() === q.toLowerCase();
                if (!isMatch) return <React.Fragment key={i}>{part}</React.Fragment>;
                return (
                    <mark
                        key={i}
                        style={{
                            background: 'rgba(250, 204, 21, 0.25)',
                            color: '#fde68a',
                            padding: `0 ${2 * uiScale}px`,
                            borderRadius: 3,
                        }}
                    >
                        {part}
                    </mark>
                );
            })}
        </>
    );
}

type Props = {
    node: any;
    nodePath: ScriptPath;
    parentArrayPath: ScriptPath;
    indexInParent: number;
    depth: number;
    uiScale: number;

    selected: boolean;
    selectedNodeIndex: number | null;
    hasValidationError: boolean;
    hasLikelyIssue: boolean;

    isCollapsed: boolean;
    onToggleCollapse: (path: ScriptPath) => void;

    dropIndicator: { arrayPath: ScriptPath; index: number } | null;
    sameArrayPath: (a: ScriptPath, b: ScriptPath) => boolean;

    onContextMenuNode: (e: React.MouseEvent, path: ScriptPath, node: any) => void;
    onClickNode: (e: React.MouseEvent, path: ScriptPath) => void;
    onDragStart: (e: React.DragEvent, path: ScriptPath) => void;
    onDragOver: (e: React.DragEvent, arrayPath: ScriptPath, index: number) => void;
    onDrop: (e: React.DragEvent, arrayPath: ScriptPath, index: number) => void;
    onDragEnd: () => void;
    dragDisabled: boolean;

    onDeleteRoot: (e: React.MouseEvent, index: number) => void;
    onPlayFrom: (index: number) => void;

    renderChild: (
        node: any,
        nodePath: ScriptPath,
        parentArrayPath: ScriptPath,
        indexInParent: number,
        depth: number
    ) => React.ReactNode;

    searchQuery?: string;
};

export function TimelineNode({
                                 node,
                                 nodePath,
                                 parentArrayPath,
                                 indexInParent,
                                 depth,
                                 uiScale,
                                 selected,
                                 selectedNodeIndex,
                                 hasValidationError,
                                 hasLikelyIssue,
                                 isCollapsed,
                                 onToggleCollapse,
                                 dropIndicator,
                                 sameArrayPath,
                                 onContextMenuNode,
                                 onClickNode,
                                 onDragStart,
                                 onDragOver,
                                 onDrop,
                                 onDragEnd,
                                 dragDisabled,
                                 onDeleteRoot,
                                 onPlayFrom,
                                 renderChild,
                                 searchQuery = '',
                             }: Props) {
    const plugin = getPlugin(node?.type || '');
    const branches: Array<{ label: string; path: ScriptPath; nodes: any[] }> =
        node?.type ? plugin.getBranches?.(node) ?? [] : [];
    const hasBranches = branches.length > 0;
    const isMacroHeader = node?.type === 'macro_header';

    const summary = String(
        isMacroHeader
            ? (node?.name || '')
            : (plugin.getSummary?.(node) || (node?.id || node?.assetUrl || node?.name || node?.scene || node?.key || ''))
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: `${2 * uiScale}px` }}>
            <div
                data-node-path={nodePath.join('.')}
                draggable={!dragDisabled}
                onDragStart={(e) => {
                    if (dragDisabled) return;
                    onDragStart(e, nodePath);
                }}
                onDragOver={(e) => {
                    if (dragDisabled) return;
                    onDragOver(e, parentArrayPath, indexInParent);
                }}
                onDrop={(e) => {
                    if (dragDisabled) return;
                    onDrop(e, parentArrayPath, indexInParent);
                }}
                onDragEnd={onDragEnd}
                onContextMenu={(e) => onContextMenuNode(e, nodePath, node)}
                onClick={(e) => onClickNode(e, nodePath)}
                style={{
                    marginLeft: `${depth * 16 * uiScale}px`,
                    padding: `${6 * uiScale}px ${10 * uiScale}px`,
                    backgroundColor: selected ? t.bg.selected : t.bg.panel,
                    borderLeft: `${3 * uiScale}px solid ${selected ? t.border.accent : 'transparent'}`,
                    borderTop:
                        !dragDisabled &&
                        dropIndicator &&
                        sameArrayPath(dropIndicator.arrayPath, parentArrayPath) &&
                        dropIndicator.index === indexInParent
                            ? `2px solid ${t.border.accent}`
                            : '2px solid transparent',
                    borderRadius: '2px',
                    fontSize: 'inherit',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: dragDisabled ? 'default' : 'grab',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: `${8 * uiScale}px`,
                        flexGrow: 1,
                        overflow: 'hidden',
                    }}
                >
                    {hasBranches ? (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleCollapse(nodePath);
                            }}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: t.text.muted,
                                cursor: 'pointer',
                                display: 'flex',
                                padding: 0,
                            }}
                        >
                            {isCollapsed ? <ChevronRight size={12 * uiScale} /> : <ChevronDown size={12 * uiScale} />}
                        </button>
                    ) : (
                        <span style={{ width: `${12 * uiScale}px` }} />
                    )}

                    <div style={{ color: '#555', fontSize: '0.8em' }}>:::</div>

                    {isMacroHeader ? <FolderTree size={14 * uiScale} color="#f59e0b" /> : plugin.icon(14 * uiScale)}

                    <span style={{ fontWeight: 'bold', color: t.text.primary }}>
                        {highlightText(String(isMacroHeader ? 'macro' : node.type ?? ''), searchQuery, uiScale)}
                    </span>

                    <span
                        style={{
                            color: isMacroHeader ? '#fbbf24' : t.text.muted,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {highlightText(isMacroHeader ? `Macro: ${summary}` : summary, searchQuery, uiScale)}
                    </span>
                </div>

                {(hasLikelyIssue || hasValidationError) && (
                    <span
                        title={hasValidationError ? 'Schema validation errors found' : 'This node looks incomplete/invalid'}
                        style={{ display: 'flex', alignItems: 'center' }}
                    >
                        <AlertTriangle size={12 * uiScale} color={hasValidationError ? '#ef4444' : '#f59e0b'} />
                    </span>
                )}

                {!isMacroHeader && depth === 0 && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onPlayFrom(nodePath[0] as number);
                        }}
                        title="Play from this command"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#4ade80',
                            cursor: 'pointer',
                        }}
                    >
                        <Play size={12 * uiScale} />
                    </button>
                )}

                {depth === 0 && selectedNodeIndex === nodePath[0] && (
                    <button
                        onClick={(e) => onDeleteRoot(e, nodePath[0] as number)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: t.accent.red,
                            cursor: 'pointer',
                            padding: '2px',
                        }}
                    >
                        <Trash2 size={12 * uiScale} />
                    </button>
                )}
            </div>

            {hasBranches &&
                !isCollapsed &&
                branches.map((branch, bIdx) => {
                    const branchArrayPath = [...nodePath, ...branch.path];
                    const labelColor = bIdx % 2 === 0 ? '#4ec9b0' : '#f59e0b';

                    return (
                        <React.Fragment key={`${nodePath.join('.')}-branch-${bIdx}`}>
                            <div
                                style={{
                                    marginLeft: `${(depth + 1) * 16 * uiScale}px`,
                                    color: labelColor,
                                    fontSize: '0.8em',
                                    marginTop: bIdx === 0 ? 0 : `${4 * uiScale}px`,
                                }}
                            >
                                {branch.label}
                            </div>

                            {branch.nodes.map((child: any, i: number) =>
                                renderChild(child, [...branchArrayPath, i], branchArrayPath, i, depth + 1)
                            )}

                            <div
                                onDragOver={(e) => {
                                    if (dragDisabled) return;
                                    onDragOver(e, branchArrayPath, branch.nodes.length);
                                }}
                                onDrop={(e) => {
                                    if (dragDisabled) return;
                                    onDrop(e, branchArrayPath, branch.nodes.length);
                                }}
                                style={{
                                    marginLeft: `${(depth + 1) * 16 * uiScale}px`,
                                    height: `${6 * uiScale}px`,
                                    borderTop:
                                        !dragDisabled &&
                                        dropIndicator &&
                                        sameArrayPath(dropIndicator.arrayPath, branchArrayPath) &&
                                        dropIndicator.index === branch.nodes.length
                                            ? `2px solid ${t.border.accent}`
                                            : '2px solid transparent',
                                }}
                            />
                        </React.Fragment>
                    );
                })}
        </div>
    );
}
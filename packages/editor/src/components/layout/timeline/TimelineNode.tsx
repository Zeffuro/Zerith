import { AlertTriangle, ChevronDown, ChevronRight, FolderTree, Play, Trash2 } from 'lucide-react';
import * as React from 'react';

import type { ScriptPath } from '../../../utils/scriptPathUtils';

import { getPlugin } from '../../../plugins/commandPlugins';
import { editorTheme as t } from '../../../theme/editorTheme';

type Properties = {
    depth: number;
    dragDisabled: boolean;
    dropIndicator: { arrayPath: ScriptPath; index: number } | null;
    hasLikelyIssue: boolean;
    hasValidationError: boolean;
    indexInParent: number;

    isCollapsed: boolean;
    node: any;
    nodePath: ScriptPath;
    onClickNode: (e: React.MouseEvent, path: ScriptPath) => void;

    onContextMenuNode: (e: React.MouseEvent, path: ScriptPath, node: any) => void;
    onDeleteRoot: (e: React.MouseEvent, index: number) => void;

    onDragEnd: () => void;
    onDragOver: (e: React.DragEvent, arrayPath: ScriptPath, index: number) => void;

    onDragStart: (e: React.DragEvent, path: ScriptPath) => void;
    onDrop: (e: React.DragEvent, arrayPath: ScriptPath, index: number) => void;
    onPlayFrom: (index: number) => void;
    onToggleCollapse: (path: ScriptPath) => void;
    parentArrayPath: ScriptPath;
    renderChild: (
        node: any,
        nodePath: ScriptPath,
        parentArrayPath: ScriptPath,
        indexInParent: number,
        depth: number
    ) => React.ReactNode;
    sameArrayPath: (a: ScriptPath, b: ScriptPath) => boolean;

    searchQuery?: string;
    selected: boolean;

    selectedNodeIndex: null | number;

    uiScale: number;
};

export function TimelineNode({
                                 depth,
                                 dragDisabled,
                                 dropIndicator,
                                 hasLikelyIssue,
                                 hasValidationError,
                                 indexInParent,
                                 isCollapsed,
                                 node,
                                 nodePath,
                                 onClickNode,
                                 onContextMenuNode,
                                 onDeleteRoot,
                                 onDragEnd,
                                 onDragOver,
                                 onDragStart,
                                 onDrop,
                                 onPlayFrom,
                                 onToggleCollapse,
                                 parentArrayPath,
                                 renderChild,
                                 sameArrayPath,
                                 searchQuery = '',
                                 selected,
                                 selectedNodeIndex,
                                 uiScale,
                             }: Properties) {
    const plugin = getPlugin(node?.type || '');
    const branches: Array<{ label: string; nodes: any[]; path: ScriptPath; }> =
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
                onClick={(e) => onClickNode(e, nodePath)}
                onContextMenu={(e) => onContextMenuNode(e, nodePath, node)}
                onDragEnd={onDragEnd}
                onDragOver={(e) => {
                    if (dragDisabled) return;
                    onDragOver(e, parentArrayPath, indexInParent);
                }}
                onDragStart={(e) => {
                    if (dragDisabled) return;
                    onDragStart(e, nodePath);
                }}
                onDrop={(e) => {
                    if (dragDisabled) return;
                    onDrop(e, parentArrayPath, indexInParent);
                }}
                style={{
                    alignItems: 'center',
                    backgroundColor: selected ? t.bg.selected : t.bg.panel,
                    borderLeft: `${3 * uiScale}px solid ${selected ? t.border.accent : 'transparent'}`,
                    borderRadius: '2px',
                    borderTop:
                        !dragDisabled &&
                        dropIndicator &&
                        sameArrayPath(dropIndicator.arrayPath, parentArrayPath) &&
                        dropIndicator.index === indexInParent
                            ? `2px solid ${t.border.accent}`
                            : '2px solid transparent',
                    cursor: dragDisabled ? 'default' : 'grab',
                    display: 'flex',
                    fontSize: 'inherit',
                    justifyContent: 'space-between',
                    marginLeft: `${depth * 16 * uiScale}px`,
                    padding: `${6 * uiScale}px ${10 * uiScale}px`,
                }}
            >
                <div
                    style={{
                        alignItems: 'center',
                        display: 'flex',
                        flexGrow: 1,
                        gap: `${8 * uiScale}px`,
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

                    <div style={{ color: t.text.faint, fontSize: '0.8em' }}>:::</div>

                    {isMacroHeader ? <FolderTree color={t.syntax.flow} size={14 * uiScale} /> : plugin.icon(14 * uiScale)}

                    <span style={{ color: t.text.primary, fontWeight: 'bold' }}>
                        {highlightText(String(isMacroHeader ? 'macro' : node.type ?? ''), searchQuery, uiScale)}
                    </span>

                    <span
                        style={{
                            color: isMacroHeader ? t.syntax.flow : t.text.muted,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {highlightText(isMacroHeader ? `Macro: ${summary}` : summary, searchQuery, uiScale)}
                    </span>
                </div>

                {(hasLikelyIssue || hasValidationError) && (
                    <span
                        style={{ alignItems: 'center', display: 'flex' }}
                        title={hasValidationError ? 'Schema validation errors found' : 'This node looks incomplete/invalid'}
                    >
                        <AlertTriangle color={hasValidationError ? t.accent.red : t.syntax.flow} size={12 * uiScale} />
                    </span>
                )}

                {!isMacroHeader && depth === 0 && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onPlayFrom(nodePath[0] as number);
                        }}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: t.accent.green,
                            cursor: 'pointer',
                        }}
                        title="Play from this command"
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
                branches.map((branch, bIndex) => {
                    const branchArrayPath = [...nodePath, ...branch.path];
                    const labelColor = bIndex % 2 === 0 ? t.syntax.logic : t.syntax.flow;

                    return (
                        <React.Fragment key={`${nodePath.join('.')}-branch-${bIndex}`}>
                            <div
                                style={{
                                    color: labelColor,
                                    fontSize: '0.8em',
                                    marginLeft: `${(depth + 1) * 16 * uiScale}px`,
                                    marginTop: bIndex === 0 ? 0 : `${4 * uiScale}px`,
                                }}
                            >
                                {branch.label}
                            </div>

                            {branch.nodes.map((child: any, index: number) =>
                                renderChild(child, [...branchArrayPath, index], branchArrayPath, index, depth + 1)
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
                                    borderTop:
                                        !dragDisabled &&
                                        dropIndicator &&
                                        sameArrayPath(dropIndicator.arrayPath, branchArrayPath) &&
                                        dropIndicator.index === branch.nodes.length
                                            ? `2px solid ${t.border.accent}`
                                            : '2px solid transparent',
                                    height: `${6 * uiScale}px`,
                                    marginLeft: `${(depth + 1) * 16 * uiScale}px`,
                                }}
                            />
                        </React.Fragment>
                    );
                })}
        </div>
    );
}

function escapeRegExp(input: string) {
    return input.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

function highlightText(text: string, query: string, uiScale: number) {
    const q = query.trim();
    if (!q) return text;

    const re = new RegExp(`(${escapeRegExp(q)})`, 'ig');
    const parts = text.split(re);

    return (
        <>
            {parts.map((part, index) => {
                const isMatch = part.toLowerCase() === q.toLowerCase();
                if (!isMatch) return <React.Fragment key={index}>{part}</React.Fragment>;
                return (
                    <mark
                        key={index}
                        style={{
                            background: t.syntax.highlightBg,
                            borderRadius: 3,
                            color: t.syntax.highlightText,
                            padding: `0 ${2 * uiScale}px`,
                        }}
                    >
                        {part}
                    </mark>
                );
            })}
        </>
    );
}

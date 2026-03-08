import { AlertTriangle, ChevronDown, ChevronRight, FolderTree, Play, Trash2 } from 'lucide-react';
import * as React from 'react';

import type { PluginNode } from '../../../plugins/types';
import type { ScriptPath } from '../../../utils/scriptPathUtilities';
import type { DropIndicator } from './types';

import { getPlugin } from '../../../plugins/commandPlugins';
import { editorTheme as t } from '../../../theme/editorTheme';

type Properties = {
    depth: number;
    dragDisabled: boolean;
    dropIndicator: DropIndicator;
    hasLikelyIssue: boolean;
    hasValidationError: boolean;
    indexInParent: number;

    isCollapsed: boolean;
    node: PluginNode;
    nodePath: ScriptPath;
    onClickNode: (event: React.MouseEvent, path: ScriptPath) => void;

    onContextMenuNode: (event: React.MouseEvent, path: ScriptPath, node: PluginNode) => void;
    onDeleteRoot: (event: React.MouseEvent, index: number) => void;

    onDragEnd: () => void;
    onDragOver: (event: React.DragEvent, arrayPath: ScriptPath, index: number) => void;

    onDragStart: (event: React.DragEvent, path: ScriptPath) => void;
    onDrop: (event: React.DragEvent, arrayPath: ScriptPath, index: number) => void;
    onPlayFrom: (index: number) => void;
    onToggleCollapse: (path: ScriptPath) => void;
    parentArrayPath: ScriptPath;
    renderChild: (
        node: PluginNode,
        nodePath: ScriptPath,
        parentArrayPath: ScriptPath,
        indexInParent: number,
        depth: number
    ) => React.ReactNode;
    sameArrayPath: (a: ScriptPath, b: ScriptPath) => boolean;

    searchQuery?: string;
    selected: boolean;

    selectedNodeIndex: number | undefined;

    uiScale: number;
};

type TimelineBranch = { label: string; nodes: PluginNode[]; path: ScriptPath; };

type TimelinePluginView = {
    getBranches?: (node: PluginNode) => TimelineBranch[];
    getSummary?: (node: PluginNode) => string;
    icon: (size: number) => React.ReactNode;
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
    const plugin = getPlugin(node.type) as unknown as TimelinePluginView;
    const branches: TimelineBranch[] = plugin.getBranches?.(node) ?? [];
    const hasBranches = branches.length > 0;
    const isMacroHeader = node.type === 'macro_header';

    const summary = isMacroHeader
        ? getStringField(node, 'name')
        : (plugin.getSummary?.(node) ?? getNodeSummaryFallback(node));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: `${2 * uiScale}px` }}>
            <div
                data-node-path={nodePath.join('.')}
                draggable={!dragDisabled}
                onClick={(event) => onClickNode(event, nodePath)}
                onContextMenu={(event) => onContextMenuNode(event, nodePath, node)}
                onDragEnd={onDragEnd}
                onDragOver={(event) => {
                    if (dragDisabled) return;
                    onDragOver(event, parentArrayPath, indexInParent);
                }}
                onDragStart={(event) => {
                    if (dragDisabled) return;
                    onDragStart(event, nodePath);
                }}
                onDrop={(event) => {
                    if (dragDisabled) return;
                    onDrop(event, parentArrayPath, indexInParent);
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
                            onClick={(event) => {
                                event.stopPropagation();
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
                        {highlightText(String(isMacroHeader ? 'macro' : node.type), searchQuery, uiScale)}
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
                        onClick={(event) => {
                            event.stopPropagation();
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
                        onClick={(event) => onDeleteRoot(event, nodePath[0] as number)}
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
                branches.map((branch, branchIndex) => {
                    const branchArrayPath = [...nodePath, ...branch.path];
                    const labelColor = branchIndex % 2 === 0 ? t.syntax.logic : t.syntax.flow;

                    return (
                        <React.Fragment key={`${nodePath.join('.')}-branch-${branchIndex}`}>
                            <div
                                style={{
                                    color: labelColor,
                                    fontSize: '0.8em',
                                    marginLeft: `${(depth + 1) * 16 * uiScale}px`,
                                    marginTop: branchIndex === 0 ? 0 : `${4 * uiScale}px`,
                                }}
                            >
                                {branch.label}
                            </div>

                            {branch.nodes.map((childNode, index) =>
                                renderChild(childNode, [...branchArrayPath, index], branchArrayPath, index, depth + 1)
                            )}

                            <div
                                onDragOver={(event) => {
                                    if (dragDisabled) return;
                                    onDragOver(event, branchArrayPath, branch.nodes.length);
                                }}
                                onDrop={(event) => {
                                    if (dragDisabled) return;
                                    onDrop(event, branchArrayPath, branch.nodes.length);
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

function getNodeSummaryFallback(node: PluginNode): string {
    const summaryKeys = ['id', 'assetUrl', 'name', 'scene', 'key'] as const;
    for (const key of summaryKeys) {
        const value = getStringField(node, key);
        if (value) return value;
    }

    return '';
}

function getStringField(node: PluginNode, key: string): string {
    const value = (node as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : '';
}

function highlightText(text: string, query: string, uiScale: number) {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return text;

    const re = new RegExp(`(${escapeRegExp(normalizedQuery)})`, 'ig');
    const parts = text.split(re);

    return (
        <>
            {parts.map((part, index) => {
                const isMatch = part.toLowerCase() === normalizedQuery.toLowerCase();
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


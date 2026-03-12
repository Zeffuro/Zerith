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
    hasBreakpoint: boolean;
    hasLikelyIssue: boolean;
    hasValidationError: boolean;
    indexInParent: number;
    isActiveExecution: boolean;

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
    onToggleBreakpoint: (index: number) => void;
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
    validationMessage?: string;
};

type TimelineBranch = { label: string; nodes: PluginNode[]; path: ScriptPath; };

type TimelinePluginView = {
    getBranches?: (node: PluginNode) => TimelineBranch[];
    getSummary?: (node: PluginNode) => string;
    icon: (size: number) => React.ReactNode;
};

const CONTAINER_STYLE: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
};

const ROW_BASE_STYLE: React.CSSProperties = {
    alignItems: 'center',
    borderRadius: '2px',
    display: 'flex',
    fontSize: 'inherit',
    justifyContent: 'space-between',
};

const CONTENT_BASE_STYLE: React.CSSProperties = {
    alignItems: 'center',
    display: 'flex',
    flexGrow: 1,
    minWidth: 0,
    overflow: 'hidden',
};

const TRANSPARENT_ICON_BUTTON_STYLE: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
};

function TimelineNodeInner({
                                 depth,
                                 dragDisabled,
                                 dropIndicator,
                                 hasBreakpoint,
                                 hasLikelyIssue,
                                 hasValidationError,
                                 indexInParent,
                                 isActiveExecution,
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
                                 onToggleBreakpoint,
                                 onToggleCollapse,
                                 parentArrayPath,
                                 renderChild,
                                 sameArrayPath,
                                 searchQuery = '',
                                 selected,
                                 selectedNodeIndex,
                                 uiScale,
                                 validationMessage,
                             }: Properties) {
    const plugin = getPlugin(node.type) as unknown as TimelinePluginView;
    const branches: TimelineBranch[] = plugin.getBranches?.(node) ?? [];
    const hasBranches = branches.length > 0;
    const isMacroHeader = node.type === 'macro_header';

    const summary = isMacroHeader
        ? getStringField(node, 'name')
        : (plugin.getSummary?.(node) ?? getNodeSummaryFallback(node));
    const indicatorTitle = hasValidationError
        ? (validationMessage ?? 'Schema validation errors found')
        : 'This node looks incomplete/invalid';

    return (
        <div style={{ ...CONTAINER_STYLE, gap: `${2 * uiScale}px` }}>
            <div
                data-node-path={nodePath.join('.')}
                draggable={!dragDisabled}
                onClick={(event) => onClickNode(event, nodePath)}
                onContextMenu={(event) => onContextMenuNode(event, nodePath, node)}
                onDragEnd={onDragEnd}
                onDragOver={(event) => {
                    if (dragDisabled) return;
                    const nextIndex = getDropIndexForEvent(event, indexInParent);
                    onDragOver(event, parentArrayPath, nextIndex);
                }}
                onDragStart={(event) => {
                    if (dragDisabled) return;
                    onDragStart(event, nodePath);
                }}
                onDrop={(event) => {
                    if (dragDisabled) return;
                    const nextIndex = getDropIndexForEvent(event, indexInParent);
                    onDrop(event, parentArrayPath, nextIndex);
                }}
                style={{
                    ...ROW_BASE_STYLE,
                    backgroundColor: isActiveExecution ? '#1f2f1f' : (selected ? t.bg.selected : t.bg.panel),
                    borderBottomColor: isActiveExecution ? t.accent.green : 'transparent',
                    borderBottomStyle: 'solid',
                    borderBottomWidth: '1px',
                    borderLeftColor: isActiveExecution ? t.accent.green : (selected ? t.border.accent : 'transparent'),
                    borderLeftStyle: 'solid',
                    borderLeftWidth: `${3 * uiScale}px`,
                    borderRightColor: isActiveExecution ? t.accent.green : 'transparent',
                    borderRightStyle: 'solid',
                    borderRightWidth: '1px',
                    borderTopColor:
                        !dragDisabled &&
                        dropIndicator &&
                        sameArrayPath(dropIndicator.arrayPath, parentArrayPath) &&
                        dropIndicator.index === indexInParent
                            ? t.border.accent
                            : 'transparent',
                    borderTopStyle: 'solid',
                    borderTopWidth: '2px',
                    boxShadow: isActiveExecution ? `0 0 ${6 * uiScale}px rgba(74, 222, 128, 0.45)` : 'none',
                    cursor: dragDisabled ? 'default' : 'grab',
                    marginLeft: `${depth * 16 * uiScale}px`,
                    padding: `${6 * uiScale}px ${10 * uiScale}px`,
                }}
            >
                <div
                    style={{
                        ...CONTENT_BASE_STYLE,
                        gap: `${8 * uiScale}px`,
                    }}
                >
                    {depth === 0 ? (
                        <button
                            onClick={(event) => {
                                event.stopPropagation();
                                const rootIndex = nodePath[0];
                                if (typeof rootIndex !== 'number') return;
                                onToggleBreakpoint(rootIndex);
                            }}
                            style={{
                                ...TRANSPARENT_ICON_BUTTON_STYLE,
                                borderRadius: '50%',
                                flexShrink: 0,
                                height: `${10 * uiScale}px`,
                                padding: 0,
                                width: `${10 * uiScale}px`,
                            }}
                            title={hasBreakpoint ? 'Remove breakpoint' : 'Add breakpoint'}
                        >
                            <span
                                style={{
                                    background: hasBreakpoint ? t.accent.red : 'transparent',
                                    border: `1px solid ${hasBreakpoint ? t.accent.red : t.border.subtle}`,
                                    borderRadius: '50%',
                                    display: 'inline-block',
                                    height: `${8 * uiScale}px`,
                                    width: `${8 * uiScale}px`,
                                }}
                            />
                        </button>
                    ) : (
                        <span style={{ width: `${10 * uiScale}px` }} />
                    )}

                    {(hasLikelyIssue || hasValidationError) ? (
                        <span
                            style={{ alignItems: 'center', display: 'flex', width: `${12 * uiScale}px` }}
                            title={indicatorTitle}
                        >
                            <AlertTriangle color={hasValidationError ? t.accent.red : t.syntax.flow} size={12 * uiScale} />
                        </span>
                    ) : (
                        <span style={{ width: `${12 * uiScale}px` }} />
                    )}

                    {hasBranches ? (
                        <button
                            onClick={(event) => {
                                event.stopPropagation();
                                onToggleCollapse(nodePath);
                            }}
                            style={{
                                ...TRANSPARENT_ICON_BUTTON_STYLE,
                                color: t.text.muted,
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

                {depth === 0 && (
                    <div
                        style={{
                            alignItems: 'center',
                            display: 'flex',
                            gap: `${4 * uiScale}px`,
                            justifyContent: 'flex-end',
                            minWidth: `${38 * uiScale}px`,
                        }}
                    >
                        {isMacroHeader ? (
                            <span style={{ width: `${14 * uiScale}px` }} />
                        ) : (
                            <button
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onPlayFrom(nodePath[0] as number);
                                }}
                                style={{
                                    ...TRANSPARENT_ICON_BUTTON_STYLE,
                                    color: t.accent.green,
                                }}
                                title="Play from this command"
                            >
                                <Play size={12 * uiScale} />
                            </button>
                        )}

                        <button
                            onClick={(event) => onDeleteRoot(event, nodePath[0] as number)}
                            style={{
                                ...TRANSPARENT_ICON_BUTTON_STYLE,
                                color: t.accent.red,
                                opacity: selectedNodeIndex === nodePath[0] ? 1 : 0,
                                padding: '2px',
                                pointerEvents: selectedNodeIndex === nodePath[0] ? 'auto' : 'none',
                            }}
                            tabIndex={selectedNodeIndex === nodePath[0] ? 0 : -1}
                        >
                            <Trash2 size={12 * uiScale} />
                        </button>
                    </div>
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

export const TimelineNode: React.NamedExoticComponent<Properties> = React.memo(
    TimelineNodeInner,
    areTimelineNodePropertiesEqual
);

function areTimelineNodePropertiesEqual(previous: Properties, next: Properties): boolean {
    return previous.depth === next.depth
        && previous.dragDisabled === next.dragDisabled
        && sameDropIndicator(previous.dropIndicator, next.dropIndicator)
        && previous.hasBreakpoint === next.hasBreakpoint
        && previous.hasLikelyIssue === next.hasLikelyIssue
        && previous.hasValidationError === next.hasValidationError
        && previous.indexInParent === next.indexInParent
        && previous.isActiveExecution === next.isActiveExecution
        && previous.isCollapsed === next.isCollapsed
        && previous.node === next.node
        && samePath(previous.nodePath, next.nodePath)
        && samePath(previous.parentArrayPath, next.parentArrayPath)
        && previous.searchQuery === next.searchQuery
        && previous.selected === next.selected
        && previous.selectedNodeIndex === next.selectedNodeIndex
        && previous.uiScale === next.uiScale
        && previous.validationMessage === next.validationMessage
        && previous.onClickNode === next.onClickNode
        && previous.onContextMenuNode === next.onContextMenuNode
        && previous.onDeleteRoot === next.onDeleteRoot
        && previous.onDragEnd === next.onDragEnd
        && previous.onDragOver === next.onDragOver
        && previous.onDragStart === next.onDragStart
        && previous.onDrop === next.onDrop
        && previous.onPlayFrom === next.onPlayFrom
        && previous.onToggleBreakpoint === next.onToggleBreakpoint
        && previous.onToggleCollapse === next.onToggleCollapse
        && previous.sameArrayPath === next.sameArrayPath;
}

function escapeRegExp(input: string) {
    return input.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

function getDropIndexForEvent(event: React.DragEvent, indexInParent: number): number {
    const row = event.currentTarget as HTMLElement;
    const bounds = row.getBoundingClientRect();
    const middleY = bounds.top + bounds.height / 2;
    return event.clientY >= middleY ? indexInParent + 1 : indexInParent;
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


function sameDropIndicator(previous: DropIndicator, next: DropIndicator): boolean {
    if (previous === next) return true;
    if (!previous || !next) return false;
    return previous.index === next.index && samePath(previous.arrayPath, next.arrayPath);
}

function samePath(a: ScriptPath, b: ScriptPath): boolean {
    if (a === b) return true;
    if (a.length !== b.length) return false;
    for (const [index, part] of a.entries()) {
        if (part !== b[index]) return false;
    }
    return true;
}

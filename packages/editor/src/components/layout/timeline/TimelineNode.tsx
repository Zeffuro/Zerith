import * as React from 'react';
import { AlertTriangle, Play, Trash2, ChevronRight, ChevronDown } from 'lucide-react';
import type { ScriptPath } from '../../../utils/scriptPathUtils';
import { getPlugin } from '../../../editor/commandPlugins';
import { editorTheme as t } from '../../../theme/editorTheme';

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
    hasLikelyIssue: (node: any) => boolean;

    isCollapsed: boolean;
    onToggleCollapse: (path: ScriptPath) => void;

    dropIndicator: { arrayPath: ScriptPath; index: number } | null;
    sameArrayPath: (a: ScriptPath, b: ScriptPath) => boolean;

    onClickNode: (e: React.MouseEvent, path: ScriptPath) => void;
    onDragStart: (e: React.DragEvent, path: ScriptPath) => void;
    onDragOver: (e: React.DragEvent, arrayPath: ScriptPath, index: number) => void;
    onDrop: (e: React.DragEvent, arrayPath: ScriptPath, index: number) => void;
    onDragEnd: () => void;

    onDeleteRoot: (e: React.MouseEvent, index: number) => void;
    onPlayFrom: (index: number) => void;

    renderChild: (
        node: any,
        nodePath: ScriptPath,
        parentArrayPath: ScriptPath,
        indexInParent: number,
        depth: number
    ) => React.ReactNode;
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
                                 onClickNode,
                                 onDragStart,
                                 onDragOver,
                                 onDrop,
                                 onDragEnd,
                                 onDeleteRoot,
                                 onPlayFrom,
                                 renderChild,
                             }: Props) {
    const plugin = getPlugin(node?.type || '');
    const branches: Array<{ label: string; path: ScriptPath; nodes: any[] }> =
        node?.type ? plugin.getBranches?.(node) ?? [] : [];
    const hasBranches = branches.length > 0;
    const summary =
        plugin.getSummary?.(node) ||
        (node?.id || node?.assetUrl || node?.name || node?.scene || node?.key || '');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: `${2 * uiScale}px` }}>
            <div
                draggable
                onDragStart={(e) => onDragStart(e, nodePath)}
                onDragOver={(e) => onDragOver(e, parentArrayPath, indexInParent)}
                onDrop={(e) => onDrop(e, parentArrayPath, indexInParent)}
                onDragEnd={onDragEnd}
                onClick={(e) => onClickNode(e, nodePath)}
                style={{
                    marginLeft: `${depth * 16 * uiScale}px`,
                    padding: `${6 * uiScale}px ${10 * uiScale}px`,
                    backgroundColor: selected ? t.bg.selected : t.bg.panel,
                    borderLeft: `${3 * uiScale}px solid ${selected ? t.border.accent : 'transparent'}`,
                    borderTop:
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
                    cursor: 'grab',
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
                            {isCollapsed ? (
                                <ChevronRight size={12 * uiScale} />
                            ) : (
                                <ChevronDown size={12 * uiScale} />
                            )}
                        </button>
                    ) : (
                        <span style={{ width: `${12 * uiScale}px` }} />
                    )}

                    <div style={{ color: '#555', fontSize: '0.8em' }}>:::</div>
                    {plugin.icon(14 * uiScale)}
                    <span style={{ fontWeight: 'bold', color: t.text.primary }}>{node.type}</span>
                    <span
                        style={{
                            color: t.text.muted,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {summary}
                    </span>
                </div>

                {(hasLikelyIssue(node) || hasValidationError) && (
                    <span
                        title={
                            hasValidationError
                                ? 'Schema validation errors found'
                                : 'This node looks incomplete/invalid'
                        }
                        style={{ display: 'flex', alignItems: 'center' }}
                    >
                        <AlertTriangle
                            size={12 * uiScale}
                            color={hasValidationError ? '#ef4444' : '#f59e0b'}
                        />
                    </span>
                )}

                {depth === 0 && (
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
                                onDragOver={(e) => onDragOver(e, branchArrayPath, branch.nodes.length)}
                                onDrop={(e) => onDrop(e, branchArrayPath, branch.nodes.length)}
                                style={{
                                    marginLeft: `${(depth + 1) * 16 * uiScale}px`,
                                    height: `${6 * uiScale}px`,
                                    borderTop:
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
import { MouseEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { NonMacroEditorCommandType, PluginNode } from '../../../plugins/types';
import type { ScriptPath } from '../../../utils/scriptPathUtilities';

import { createDefaultCommand, getAllPlugins, getPlugin } from '../../../plugins/commandPlugins';
import { hasLikelyIssue } from '../../../plugins/likelyIssues';
import { executeTimelineContextAction } from '../../../store/actions/timelineContextActions';
import { useProjectStore } from '../../../store/storeBootstrap';
import { useScriptStore } from '../../../store/storeBootstrap';
import { useEditorStore } from '../../../store/useEditorStore';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { useWorkbenchStore } from '../../../store/useWorkbenchStore';
import { resolveComponentScale, editorTheme as t } from '../../../theme/editorTheme';
import { ConfirmDialog } from '../../ConfirmDialog';
import { TimelineCommandBar } from './TimelineCommandBar';
import { type CommandContextMenuState, TimelineCommandContextMenu } from './TimelineCommandContextMenu';
import { TimelineDropZone } from './TimelineDropZone';
import { TimelineEmptyState } from './TimelineEmptyState';
import { TimelineMinimap, type TimelineMinimapRow } from './TimelineMinimap';
import { TimelineNode } from './TimelineNode';
import { TimelineSearchBar } from './TimelineSearchBar';
import { TimelineTypeFilterChips } from './TimelineTypeFilterChips';
import { useTimelineDragDrop } from './useTimelineDragDrop';
import { useTimelineSearch } from './useTimelineSearch';
import { useTimelineSelection } from './useTimelineSelection';

type FlattenContext = {
    collapsed: Record<string, boolean>;
    isSearching: boolean;
};

type FlattenNode = {
    node: PluginNode;
    path: ScriptPath;
};

type TimelineBranch = {
    nodes: PluginNode[];
    path: ScriptPath;
};


export function Timeline() {
    const globalUiScale = useEditorStore((state) => state.uiScale);
    const timelineScale = useSettingsStore((state) => state.timelineScale);
    const uiScale = resolveComponentScale(globalUiScale, timelineScale);
    const activeExecutionPath = useEditorStore((state) => state.activeExecutionPath);
    const breakpoints = useEditorStore((state) => state.breakpoints);
    const toggleBreakpoint = useEditorStore((state) => state.toggleBreakpoint);
    const quickCommandTypes = useEditorStore((state) => state.quickCommandTypes);
    const triggerPlayFrom = useEditorStore((state) => state.triggerPlayFrom);
    const validationErrors = useEditorStore((state) => state.validationErrors);
    const pendingDeleteRequest = useEditorStore((state) => state.pendingDeleteRequest);
    const clearDeleteRequest = useEditorStore((state) => state.clearDeleteRequest);
    const requestDelete = useEditorStore((state) => state.requestDelete);
    const clearSelection = useEditorStore((state) => state.clearSelection);
    const selectedNodePaths = useEditorStore((s) => s.selectedNodePaths);

    const editingAllMacrosFile = useProjectStore((s) => s.editingAllMacrosFile);
    const activeFile = useProjectStore((s) => s.activeFile);
    const setLastScriptView = useWorkbenchStore((s) => s.setLastScriptView);
    const setLastMacrosView = useWorkbenchStore((s) => s.setLastMacrosView);
    const macroEntries = useProjectStore((s) => s.macroEntries);
    const setMacroEntries = useProjectStore((s) => s.setMacroEntries);
    const addMacroEntry = useProjectStore((s) => s.addMacroEntry);
    const deleteMacroEntries = useProjectStore((s) => s.deleteMacroEntries);

    const [contextMenu, setContextMenu] = useState<CommandContextMenuState>();
    const contextPathReference = useRef<ScriptPath | undefined>(undefined);

    const { onNodeClick, selectedKeys } = useTimelineSelection();
    const {
        dropIndicator,
        handleDragEnd,
        handleNodeDragOver,
        handleNodeDragStart,
        handleNodeDrop,
        sameArrayPath,
    } = useTimelineDragDrop();

    const {
        addNode,
        deleteNodeByPath,
        deleteNodesByPaths,
        rootScript,
        selectedNodeIndex,
    } = useScriptStore();

    const allPlugins = useMemo(() => getAllPlugins(), []);
    const commandMenuItems = useMemo(
        () => allPlugins.map((p) => ({ icon: p.icon(14 * uiScale), label: p.label, type: p.type })),
        [allPlugins, uiScale]
    );
    const quickTypes = useMemo(() => [...quickCommandTypes], [quickCommandTypes]);

    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const [typeFilter, setTypeFilter] = useState('all');

    const timelineRootReference = useRef<HTMLDivElement | null>(null);
    const timelineScrollReference = useRef<HTMLDivElement | null>(null);
    const searchInputId = 'timeline-search-input';

    const rootNodes = useMemo(() => {
        if (editingAllMacrosFile) return macroEntries.map((m) => macroNode(m.name, m.commands));
        return Array.isArray(rootScript) ? rootScript : [];
    }, [editingAllMacrosFile, macroEntries, rootScript]);

    const typeChips = useMemo(() => {
        const map = new Map<string, number>();
        for (const n of rootNodes) {
            const type = typeof n?.type === 'string' ? n.type : 'unknown';
            map.set(type, (map.get(type) ?? 0) + 1);
        }
        return [...map.entries()]
            .map(([type, count]) => ({ count, type }))
            .toSorted((a, b) => a.type.localeCompare(b.type));
    }, [rootNodes]);

    const {
        activeMatchDisplayIndex,
        goToNextMatch,
        goToPrevMatch,
        isSearching,
        matchCount,
        query,
        setQuery,
        visibleRoot,
    } = useTimelineSearch(rootNodes, typeFilter);

    const validationEntries = useMemo(() => Object.entries(validationErrors), [validationErrors]);

    const minimapRows = useMemo<TimelineMinimapRow[]>(() => {
        const renderedNodes = flattenRenderedNodes(visibleRoot, {
            collapsed,
            isSearching,
        });

        const activeBreakpointSet = new Set<number>(activeFile ? (breakpoints[activeFile] ?? []) : []);

        return renderedNodes.map(({ node, path }, index) => {
            const plugin = getPlugin(node.type);
            const commandIndex = path.length === 1 && typeof path[0] === 'number' ? path[0] : undefined;

            return {
                color: plugin.quickColor?.border ?? getMinimapFallbackColor(node.type),
                hasBreakpoint: commandIndex !== undefined && activeBreakpointSet.has(commandIndex),
                index,
                isActiveExecution: samePath(path, activeExecutionPath ?? []),
                pathKey: path.join('.'),
                typeLabel: plugin.label,
            };
        });
    }, [activeExecutionPath, activeFile, breakpoints, collapsed, isSearching, visibleRoot]);

    const [scrollMetrics, setScrollMetrics] = useState({
        clientHeight: 1,
        scrollHeight: 1,
        scrollTop: 0,
    });
    const maxScrollTop = Math.max(1, scrollMetrics.scrollHeight - scrollMetrics.clientHeight);

    const refreshScrollMetrics = useCallback(() => {
        const element = timelineScrollReference.current;
        if (!element) return;

        const next = {
            clientHeight: Math.max(1, element.clientHeight),
            scrollHeight: Math.max(1, element.scrollHeight),
            scrollTop: Math.max(0, element.scrollTop),
        };

        setScrollMetrics((previous) => {
            if (
                previous.clientHeight === next.clientHeight
                && previous.scrollHeight === next.scrollHeight
                && previous.scrollTop === next.scrollTop
            ) {
                return previous;
            }
            return next;
        });
    }, []);

    const resolveValidationDetails = useCallback((nodePath: ScriptPath) => {
        if (validationEntries.length === 0) {
            return { hasValidationError: false };
        }

        const prefix = editingAllMacrosFile
            ? (() => {
                const [macroIndex, ...rest] = nodePath;
                if (typeof macroIndex !== 'number') return '';
                return `macro.${macroIndex}.${rest.join('.')}`;
            })()
            : nodePath.join('.');

        if (!prefix) {
            return { hasValidationError: false };
        }

        const matchedMessages: string[] = [];

        for (const [key, messages] of validationEntries) {
            if (key !== prefix && !key.startsWith(`${prefix}.`)) continue;

            const relativeKey = key === prefix ? '' : key.slice(prefix.length + 1);
            for (const message of messages) {
                matchedMessages.push(relativeKey ? `${relativeKey}: ${message}` : message);
            }
        }

        if (matchedMessages.length === 0) {
            return { hasValidationError: false };
        }

        const visibleMessages = matchedMessages.slice(0, 5);
        const remainingCount = matchedMessages.length - visibleMessages.length;
        const validationMessage = remainingCount > 0
            ? `${visibleMessages.join('\n')}\n(+${remainingCount} more)`
            : visibleMessages.join('\n');

        return { hasValidationError: true, validationMessage };
    }, [editingAllMacrosFile, validationEntries]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const isFind = (event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'f';
            if (!isFind) return;

            const rootElement = timelineRootReference.current;
            if (!rootElement) return;

            const active = document.activeElement as HTMLElement | null;
            const insideTimeline = !!(active && rootElement.contains(active));
            if (!insideTimeline) return;

            event.preventDefault();
            const input = document.querySelector<HTMLInputElement>(`#${searchInputId}`);
            if (!input) return;
            input.focus();
            input.select();
        };

        globalThis.addEventListener('keydown', onKeyDown);
        return () => globalThis.removeEventListener('keydown', onKeyDown);
    }, []);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;

            const input = document.querySelector<HTMLInputElement>(`#${searchInputId}`);
            if (!input) return;

            const rootElement = timelineRootReference.current;
            if (!rootElement) return;

            const active = document.activeElement as HTMLElement | null;
            const insideTimeline = !!(active && rootElement.contains(active));
            if (!insideTimeline) return;

            if (query) {
                event.preventDefault();
                setQuery('');
                input.focus();
            } else if (active === input) {
                input.blur();
            }
        };

        globalThis.addEventListener('keydown', onKeyDown);
        return () => globalThis.removeEventListener('keydown', onKeyDown);
    }, [query, setQuery]);

    useEffect(() => {
        if (editingAllMacrosFile) setLastMacrosView('timeline');
        else setLastScriptView('timeline');
    }, [editingAllMacrosFile, setLastMacrosView, setLastScriptView]);

    useEffect(() => {
        const firstSelectedPath = selectedNodePaths[0];
        if (!firstSelectedPath) return;

        const key = firstSelectedPath.join('.');
        const root = timelineRootReference.current;
        if (!root) return;

        const nodes = root.querySelectorAll<HTMLElement>('[data-node-path]');
        const target = [...nodes].find((node) => node.dataset.nodePath === key);
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [selectedNodePaths]);

    useEffect(() => {
        if (!contextMenu) return;
        const onDown = () => setContextMenu(undefined);
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setContextMenu(undefined);
        };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [contextMenu]);

    useEffect(() => {
        const element = timelineScrollReference.current;
        if (!element) return;

        const onScroll = () => refreshScrollMetrics();
        element.addEventListener('scroll', onScroll, { passive: true });
        globalThis.addEventListener('resize', onScroll);
        queueMicrotask(onScroll);

        return () => {
            element.removeEventListener('scroll', onScroll);
            globalThis.removeEventListener('resize', onScroll);
        };
    }, [refreshScrollMetrics]);

    useEffect(() => {
        queueMicrotask(() => refreshScrollMetrics());
    }, [refreshScrollMetrics, visibleRoot]);

    const toggleCollapse = useCallback((path: ScriptPath) => {
        const key = pathKey(path);
        setCollapsed((previous) => ({ ...previous, [key]: !previous[key] }));
    }, []);

    const handleDeleteRootNode = useCallback((event_: MouseEvent, index: number) => {
        event_.stopPropagation();
        requestDelete([[index]], 'click');
    }, [requestDelete]);

    const onContextMenuNode = useCallback((event_: React.MouseEvent, path: ScriptPath, _node: unknown) => {
        void _node;
        event_.preventDefault();
        event_.stopPropagation();

        const canPlayFrom = path.length === 1 && typeof path[0] === 'number' && !editingAllMacrosFile;
        const clipboard = useEditorStore.getState().clipboardNode;
        const canPaste = !!clipboard;

        contextPathReference.current = path;
        setContextMenu({
            canPaste,
            canPlayFrom,
            onAction: (action) => {
                const p = contextPathReference.current;
                if (!p) return;
                executeTimelineContextAction({
                    action,
                    path: p,
                    requestDelete,
                    triggerPlayFrom,
                });
            },
            onClose: () => setContextMenu(undefined),
            x: event_.clientX,
            y: event_.clientY,
        });
    }, [editingAllMacrosFile, requestDelete, triggerPlayFrom]);

    const handleConfirmDelete = () => {
        const request = useEditorStore.getState().pendingDeleteRequest;
        if (!request || request.paths.length === 0) {
            clearDeleteRequest();
            return;
        }

        if (editingAllMacrosFile) {
            const indices = request.paths
                .filter((p) => p.length === 1 && typeof p[0] === 'number')
                .map((p) => p[0] as number);
            deleteMacroEntries(indices);
        } else {
            if (request.paths.length > 1) deleteNodesByPaths(request.paths);
            else deleteNodeByPath(request.paths[0]);
        }

        clearSelection();
        clearDeleteRequest();
    };

    const getQuickMeta = (type: NonMacroEditorCommandType) => {
        const p = getPlugin(type);
        return {
            bg: p.quickColor?.bg ?? '#333',
            border: p.quickColor?.border ?? '#444',
            icon: p.icon(14 * uiScale),
            title: p.label,
        };
    };

    const handleAddCommand = (type: NonMacroEditorCommandType) => {
        const cmd = createDefaultCommand(type);

        if (!editingAllMacrosFile) {
            addNode(cmd);
            return;
        }

        const selectedRoot = selectedNodePaths.find((p) => p.length > 0 && typeof p[0] === 'number');
        let macroIndex = selectedRoot && typeof selectedRoot[0] === 'number' ? selectedRoot[0] : undefined;

        const next = [...macroEntries];

        if (macroIndex === undefined || !next[macroIndex]) {
            const name = `new_macro_${next.length + 1}`;
            next.push({ commands: [], name });
            macroIndex = next.length - 1;
        }

        next[macroIndex] = {
            ...next[macroIndex],
            commands: [...(next[macroIndex].commands ?? []), cmd],
        };

        setMacroEntries(next);
    };

    const renderNode = (
        node: PluginNode,
        nodePath: ScriptPath,
        parentArrayPath: ScriptPath,
        indexInParent: number,
        depth: number
    ): ReactNode => {
        const nodePrefix = nodePath.join('.');

        const { hasValidationError, validationMessage } = resolveValidationDetails(nodePath);

        const dragDisabled = isSearching || typeFilter !== 'all';
        const hasBreakpoint = Boolean(
            activeFile
            && nodePath.length === 1
            && typeof nodePath[0] === 'number'
            && breakpoints[activeFile]?.includes(nodePath[0])
        );
        const isActiveExecution = samePath(nodePath, activeExecutionPath ?? []);

        return (
            <TimelineNode
                depth={depth}
                dragDisabled={dragDisabled}
                dropIndicator={dropIndicator}
                hasBreakpoint={hasBreakpoint}
                hasLikelyIssue={!editingAllMacrosFile && hasLikelyIssue(node)}
                hasValidationError={hasValidationError}
                indexInParent={indexInParent}
                isActiveExecution={isActiveExecution}
                isCollapsed={isSearching ? false : collapsed[pathKey(nodePath)]}
                key={nodePrefix}
                node={node}
                nodePath={nodePath}
                onClickNode={onNodeClick}
                onContextMenuNode={onContextMenuNode}
                onDeleteRoot={handleDeleteRootNode}
                onDragEnd={handleDragEnd}
                onDragOver={handleNodeDragOver}
                onDragStart={handleNodeDragStart}
                onDrop={handleNodeDrop}
                onPlayFrom={triggerPlayFrom}
                onToggleBreakpoint={(index: number) => {
                    if (!activeFile) return;
                    toggleBreakpoint(activeFile, index);
                }}
                onToggleCollapse={toggleCollapse}
                parentArrayPath={parentArrayPath}
                renderChild={renderNode}
                sameArrayPath={sameArrayPath}
                searchQuery={query}
                selected={selectedKeys.has(nodePrefix)}
                selectedNodeIndex={selectedNodeIndex}
                uiScale={uiScale}
                validationMessage={validationMessage}
            />
        );
    };

    return (
        <div
            ref={timelineRootReference}
            style={{
                backgroundColor: t.bg.app,
                display: 'flex',
                flexDirection: 'column',
                fontSize: `${12 * uiScale}px`,
                height: '100%',
                minHeight: 0,
                outline: 'none',
                overflow: 'hidden',
                padding: `${8 * uiScale}px`,
            }}
            tabIndex={0}
        >
            <div
                style={{
                    backgroundColor: t.bg.app,
                    display: 'flex',
                    flexDirection: 'column',
                    flexShrink: 0,
                    gap: `${4 * uiScale}px`,
                    paddingBottom: `${4 * uiScale}px`,
                }}
            >
                <TimelineCommandBar
                    commandMenuItems={commandMenuItems}
                    getQuickMeta={getQuickMeta}
                    onAdd={handleAddCommand}
                    quickTypes={quickTypes}
                    uiScale={uiScale}
                />

                {editingAllMacrosFile && (
                    <div>
                        <button
                            onClick={() => addMacroEntry()}
                            style={{
                                alignItems: 'center',
                                background: t.accent.primary,
                                border: `1px solid ${t.border.primaryBtn}`,
                                borderRadius: t.radius.md,
                                boxSizing: 'border-box',
                                color: t.text.primary,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                fontSize: '0.85em',
                                fontWeight: 'bold',
                                height: `${26 * uiScale}px`,
                                justifyContent: 'center',
                                padding: `0 ${10 * uiScale}px`,
                            }}
                        >
                            + Add Macro
                        </button>
                    </div>
                )}

                <TimelineSearchBar
                    activeMatchDisplayIndex={activeMatchDisplayIndex}
                    inputId={searchInputId}
                    isSearching={isSearching}
                    matchCount={matchCount}
                    onChangeQuery={setQuery}
                    onNextMatch={goToNextMatch}
                    onPrevMatch={goToPrevMatch}
                    query={query}
                    shown={visibleRoot.length}
                    total={rootNodes.length}
                    uiScale={uiScale}
                />

                <TimelineTypeFilterChips
                    activeType={typeFilter}
                    chips={typeChips}
                    onChange={setTypeFilter}
                    uiScale={uiScale}
                />

                {isSearching && (
                    <div style={{ fontSize: `${11 * uiScale}px`, opacity: 0.75 }}>
                        Search active: drag/reorder is temporarily disabled.
                    </div>
                )}

                    {!isSearching && typeFilter !== 'all' && (
                        <div style={{ fontSize: `${11 * uiScale}px`, opacity: 0.75 }}>
                            Type filter active: drag/reorder is temporarily disabled.
                        </div>
                    )}
            </div>

            <div style={{ display: 'flex', flex: 1, gap: `${8 * uiScale}px`, minHeight: 0 }}>
                <div
                    className="zerith-scrollbar"
                    ref={timelineScrollReference}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        flexGrow: 1,
                        gap: `${2 * uiScale}px`,
                        minHeight: 0,
                        overflowY: 'auto',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                    }}
                >
                    {visibleRoot.map(({ index, node }) => renderNode(node, [index], [], index, 0))}

                    {!isSearching && typeFilter === 'all' && (
                        <TimelineDropZone
                            borderAccent={t.border.accent}
                            dropIndicator={dropIndicator}
                            onDragOver={handleNodeDragOver}
                            onDrop={handleNodeDrop}
                            rootCount={rootNodes.length}
                            sameArrayPath={sameArrayPath}
                            uiScale={uiScale}
                        />
                    )}

                    {visibleRoot.length === 0 && <TimelineEmptyState />}
                </div>

                <TimelineMinimap
                    onSeek={(ratio) => {
                        const element = timelineScrollReference.current;
                        if (!element) return;
                        const maxScroll = Math.max(0, element.scrollHeight - element.clientHeight);
                        element.scrollTop = maxScroll * ratio;
                        refreshScrollMetrics();
                    }}
                    rows={minimapRows}
                    uiScale={uiScale}
                    viewportHeightRatio={scrollMetrics.clientHeight / scrollMetrics.scrollHeight}
                    viewportStartRatio={scrollMetrics.scrollTop / maxScrollTop}
                />
            </div>

            <ConfirmDialog
                cancelText="Cancel"
                confirmText="Delete"
                danger
                message={`This will delete ${pendingDeleteRequest?.paths.length ?? 0} item(s).`}
                onCancel={clearDeleteRequest}
                onConfirm={handleConfirmDelete}
                open={!!pendingDeleteRequest}
                title="Delete selected command(s)?"
            />

            <TimelineCommandContextMenu menu={contextMenu} uiScale={uiScale} />
        </div>
    );
}


function flattenRenderedNodes(
    root: { index: number; node: PluginNode }[],
    context: FlattenContext
): FlattenNode[] {
    const output: FlattenNode[] = [];

    const visit = (node: PluginNode, nodePath: ScriptPath) => {
        output.push({ node, path: nodePath });

        const plugin = getPlugin(node.type) as { getBranches?: (node_: PluginNode) => TimelineBranch[] };
        const branches = plugin.getBranches?.(node) ?? [];
        if (branches.length === 0) return;

        const isCollapsed = !context.isSearching && context.collapsed[pathKey(nodePath)];
        if (isCollapsed) return;

        for (const branch of branches) {
            const branchArrayPath = [...nodePath, ...branch.path];
            for (const [index, childNode] of branch.nodes.entries()) {
                visit(childNode, [...branchArrayPath, index]);
            }
        }
    };

    for (const { index, node } of root) {
        visit(node, [index]);
    }

    return output;
}

function getMinimapFallbackColor(type: string): string {
    const colors = [
        t.accent.blue,
        t.accent.teal,
        t.accent.purple,
        t.accent.orange,
        t.accent.yellow,
        t.accent.green,
        t.accent.red,
    ];
    let hash = 0;
    for (const char of type) {
        hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
    }
    return colors[hash % colors.length];
}

function macroNode(name: string, commands: PluginNode[]) {
    return { body: commands, name, type: 'macro_header' };
}

function pathKey(path: ScriptPath) {
    return path.join('.');
}

function samePath(a: ScriptPath, b: ScriptPath): boolean {
    if (a.length !== b.length) return false;
    for (const [index, value] of a.entries()) {
        if (value !== b[index]) return false;
    }
    return true;
}



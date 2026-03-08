import { ReactNode, MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { ScriptPath } from '../../../utils/scriptPathUtils';

import { useScriptStore } from '../../../store/useScriptStore';
import { useEditorStore } from '../../../store/useEditorStore';
import { useProjectStore } from '../../../store/useProjectStore';
import { useWorkbenchStore } from '../../../store/useWorkbenchStore';
import { createDefaultCommand, getPlugin, getAllPlugins } from '../../../plugins/commandPlugins';
import type { NonMacroEditorCommandType, PluginNode } from '../../../plugins/types';
import { hasLikelyIssue } from '../../../plugins/likelyIssues';
import { editorTheme as t } from '../../../theme/editorTheme';

import { useTimelineSelection } from './useTimelineSelection';
import { useTimelineDragDrop } from './useTimelineDragDrop';
import { useTimelineSearch } from './useTimelineSearch';
import { TimelineNode } from './TimelineNode';
import { TimelineCommandBar } from './TimelineCommandBar';
import { TimelineDropZone } from './TimelineDropZone';
import { TimelineEmptyState } from './TimelineEmptyState';
import { TimelineSearchBar } from './TimelineSearchBar';
import { TimelineTypeFilterChips } from './TimelineTypeFilterChips';
import { type CommandContextMenuState, TimelineCommandContextMenu } from './TimelineCommandContextMenu';
import { ConfirmDialog } from '../../ConfirmDialog';
import { executeTimelineContextAction } from '../../../store/actions/timelineContextActions';


function pathKey(path: ScriptPath) {
    return path.join('.');
}

function macroNode(name: string, commands: PluginNode[]) {
    return { type: 'macro_header', name, body: commands };
}

export function Timeline() {
    const uiScale = useEditorStore((state) => state.uiScale);
    const quickCommandTypes = useEditorStore((state) => state.quickCommandTypes);
    const triggerPlayFrom = useEditorStore((state) => state.triggerPlayFrom);
    const validationErrors = useEditorStore((state) => state.validationErrors);
    const pendingDeleteRequest = useEditorStore((state) => state.pendingDeleteRequest);
    const clearDeleteRequest = useEditorStore((state) => state.clearDeleteRequest);
    const requestDelete = useEditorStore((state) => state.requestDelete);
    const clearSelection = useEditorStore((state) => state.clearSelection);
    const selectedNodePaths = useEditorStore((s) => s.selectedNodePaths);

    const editingAllMacrosFile = useProjectStore((s) => s.editingAllMacrosFile);
    const setLastScriptView = useWorkbenchStore((s) => s.setLastScriptView);
    const setLastMacrosView = useWorkbenchStore((s) => s.setLastMacrosView);
    const macroEntries = useProjectStore((s) => s.macroEntries);
    const setMacroEntries = useProjectStore((s) => s.setMacroEntries);
    const addMacroEntry = useProjectStore((s) => s.addMacroEntry);
    const deleteMacroEntries = useProjectStore((s) => s.deleteMacroEntries);

    const [contextMenu, setContextMenu] = useState<CommandContextMenuState>(null);
    const contextPathRef = useRef<ScriptPath | null>(null);

    const { selectedKeys, onNodeClick } = useTimelineSelection();
    const {
        dropIndicator,
        sameArrayPath,
        handleNodeDragStart,
        handleNodeDragOver,
        handleNodeDrop,
        handleDragEnd,
    } = useTimelineDragDrop();

    const {
        rootScript,
        selectedNodeIndex,
        addNode,
        deleteNodeByPath,
        deleteNodesByPaths,
    } = useScriptStore();

    const allPlugins = useMemo(() => getAllPlugins(), []);
    const commandMenuItems = useMemo(
        () => allPlugins.map((p) => ({ type: p.type as NonMacroEditorCommandType, label: p.label, icon: p.icon(14 * uiScale) })),
        [allPlugins, uiScale]
    );
    const quickTypes = useMemo(() => [...quickCommandTypes], [quickCommandTypes]);

    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const [typeFilter, setTypeFilter] = useState('all');

    const timelineRootRef = useRef<HTMLDivElement | null>(null);
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
        return Array.from(map.entries())
            .map(([type, count]) => ({ type, count }))
            .sort((a, b) => a.type.localeCompare(b.type));
    }, [rootNodes]);

    const {
        query,
        setQuery,
        isSearching,
        visibleRoot,
        matchCount,
        activeMatchDisplayIndex,
        goToNextMatch,
        goToPrevMatch,
    } = useTimelineSearch(rootNodes, typeFilter);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const isFind = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f';
            if (!isFind) return;

            const rootEl = timelineRootRef.current;
            if (!rootEl) return;

            const active = document.activeElement as HTMLElement | null;
            const insideTimeline = !!(active && rootEl.contains(active));
            if (!insideTimeline) return;

            e.preventDefault();
            const input = document.getElementById(searchInputId) as HTMLInputElement | null;
            if (!input) return;
            input.focus();
            input.select();
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;

            const input = document.getElementById(searchInputId) as HTMLInputElement | null;
            if (!input) return;

            const rootEl = timelineRootRef.current;
            if (!rootEl) return;

            const active = document.activeElement as HTMLElement | null;
            const insideTimeline = !!(active && rootEl.contains(active));
            if (!insideTimeline) return;

            if (query) {
                e.preventDefault();
                setQuery('');
                input.focus();
            } else if (active === input) {
                input.blur();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [query, setQuery]);

    useEffect(() => {
        if (editingAllMacrosFile) setLastMacrosView('timeline');
        else setLastScriptView('timeline');
    }, [editingAllMacrosFile]);

    useEffect(() => {
        if (!contextMenu) return;
        const onDown = () => setContextMenu(null);
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setContextMenu(null);
        };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [contextMenu]);

    const toggleCollapse = (path: ScriptPath) => {
        const key = pathKey(path);
        setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const handleDeleteRootNode = (e: MouseEvent, index: number) => {
        e.stopPropagation();
        requestDelete([[index]], 'click');
    };

    const onContextMenuNode = (e: React.MouseEvent, path: ScriptPath, _node: any) => {
        e.preventDefault();
        e.stopPropagation();

        const canPlayFrom = path.length === 1 && typeof path[0] === 'number' && !editingAllMacrosFile;
        const clipboard = useEditorStore.getState().clipboardNode;
        const canPaste = !!clipboard;

        contextPathRef.current = path;
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            canPlayFrom,
            canPaste,
            onClose: () => setContextMenu(null),
            onAction: (action) => {
                const p = contextPathRef.current;
                if (!p) return;
                executeTimelineContextAction({
                    action,
                    path: p,
                    requestDelete,
                    triggerPlayFrom,
                });
            },
        });
    };

    const handleConfirmDelete = () => {
        const req = useEditorStore.getState().pendingDeleteRequest;
        if (!req || req.paths.length === 0) {
            clearDeleteRequest();
            return;
        }

        if (editingAllMacrosFile) {
            const indices = req.paths
                .filter((p) => p.length === 1 && typeof p[0] === 'number')
                .map((p) => p[0] as number);
            deleteMacroEntries(indices);
        } else {
            if (req.paths.length > 1) deleteNodesByPaths(req.paths);
            else deleteNodeByPath(req.paths[0]);
        }

        clearSelection();
        clearDeleteRequest();
    };

    const getQuickMeta = (type: NonMacroEditorCommandType) => {
        const p = getPlugin(type);
        return {
            icon: p.icon(14 * uiScale),
            title: p.label,
            bg: p.quickColor?.bg ?? '#333',
            border: p.quickColor?.border ?? '#444',
        };
    };

    const handleAddCommand = (type: NonMacroEditorCommandType) => {
        const cmd = createDefaultCommand(type);

        if (!editingAllMacrosFile) {
            addNode(cmd);
            return;
        }

        const selectedRoot = selectedNodePaths.find((p) => p.length > 0 && typeof p[0] === 'number');
        let macroIndex = selectedRoot && typeof selectedRoot[0] === 'number' ? (selectedRoot[0] as number) : null;

        let next = [...macroEntries];

        if (macroIndex === null || !next[macroIndex]) {
            const name = `new_macro_${next.length + 1}`;
            next.push({ name, commands: [] });
            macroIndex = next.length - 1;
        }

        next[macroIndex] = {
            ...next[macroIndex],
            commands: [...(next[macroIndex].commands ?? []), cmd],
        };

        setMacroEntries(next);
    };

    const renderNode = (
        node: any,
        nodePath: ScriptPath,
        parentArrayPath: ScriptPath,
        indexInParent: number,
        depth: number
    ): ReactNode => {
        const nodePrefix = nodePath.join('.');

        const hasValidationError = editingAllMacrosFile
            ? (() => {
                const [macroIndex, ...rest] = nodePath;
                if (typeof macroIndex !== 'number') return false;
                const prefix = `macro.${macroIndex}.${rest.join('.')}`;
                return Object.keys(validationErrors).some((k) => k === prefix || k.startsWith(prefix + '.'));
            })()
            : Object.keys(validationErrors).some((k) => k === nodePrefix || k.startsWith(nodePrefix + '.'));

        return (
            <TimelineNode
                key={nodePrefix}
                node={node}
                nodePath={nodePath}
                parentArrayPath={parentArrayPath}
                indexInParent={indexInParent}
                depth={depth}
                uiScale={uiScale}
                selected={selectedKeys.has(nodePrefix)}
                selectedNodeIndex={selectedNodeIndex}
                hasValidationError={hasValidationError}
                hasLikelyIssue={!editingAllMacrosFile && hasLikelyIssue(node)}
                isCollapsed={isSearching ? false : collapsed[pathKey(nodePath)]}
                onToggleCollapse={toggleCollapse}
                dropIndicator={dropIndicator}
                sameArrayPath={sameArrayPath}
                onContextMenuNode={onContextMenuNode}
                onClickNode={onNodeClick}
                onDragStart={handleNodeDragStart}
                onDragOver={handleNodeDragOver}
                onDrop={handleNodeDrop}
                onDragEnd={handleDragEnd}
                onDeleteRoot={handleDeleteRootNode}
                onPlayFrom={triggerPlayFrom}
                renderChild={renderNode}
                dragDisabled={isSearching}
                searchQuery={query}
            />
        );
    };

    return (
        <div
            ref={timelineRootRef}
            tabIndex={0}
            style={{
                padding: `${8 * uiScale}px`,
                height: '100%',
                backgroundColor: t.bg.app,
                display: 'flex',
                flexDirection: 'column',
                outline: 'none',
            }}
        >
            <TimelineCommandBar
                uiScale={uiScale}
                commandMenuItems={commandMenuItems}
                quickTypes={quickTypes}
                onAdd={handleAddCommand}
                getQuickMeta={getQuickMeta}
            />

            {editingAllMacrosFile && (
                <div style={{ marginBottom: `${8 * uiScale}px` }}>
                    <button
                        onClick={() => addMacroEntry()}
                        style={{
                            background: t.accent.primary,
                            border: `1px solid ${t.border.primaryBtn}`,
                            color: t.text.primary,
                            borderRadius: t.radius.md,
                            padding: `0 ${10 * uiScale}px`,
                            height: `${26 * uiScale}px`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxSizing: 'border-box',
                            cursor: 'pointer',
                            fontSize: '0.85em',
                            fontWeight: 'bold',
                        }}
                    >
                        + Add Macro
                    </button>
                </div>
            )}

            <TimelineSearchBar
                uiScale={uiScale}
                query={query}
                onChangeQuery={setQuery}
                shown={visibleRoot.length}
                total={rootNodes.length}
                isSearching={isSearching}
                matchCount={matchCount}
                activeMatchDisplayIndex={activeMatchDisplayIndex}
                onPrevMatch={goToPrevMatch}
                onNextMatch={goToNextMatch}
                inputId={searchInputId}
            />

            <TimelineTypeFilterChips
                uiScale={uiScale}
                chips={typeChips}
                activeType={typeFilter}
                onChange={setTypeFilter}
            />

            {isSearching && (
                <div style={{ fontSize: `${11 * uiScale}px`, opacity: 0.75, marginBottom: `${6 * uiScale}px` }}>
                    Search active: drag/reorder is temporarily disabled.
                </div>
            )}

            <div
                className="zerith-scrollbar"
                style={{
                    flexGrow: 1,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: `${2 * uiScale}px`,
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                }}
            >
                {visibleRoot.map(({ node, index }) => renderNode(node, [index], [], index, 0))}

                {!isSearching && (
                    <TimelineDropZone
                        uiScale={uiScale}
                        rootCount={rootNodes.length}
                        dropIndicator={dropIndicator}
                        sameArrayPath={sameArrayPath}
                        onDragOver={handleNodeDragOver}
                        onDrop={handleNodeDrop}
                        borderAccent={t.border.accent}
                    />
                )}

                {visibleRoot.length === 0 && <TimelineEmptyState />}
            </div>

            <ConfirmDialog
                open={!!pendingDeleteRequest}
                title="Delete selected command(s)?"
                message={`This will delete ${pendingDeleteRequest?.paths.length ?? 0} item(s).`}
                confirmText="Delete"
                cancelText="Cancel"
                danger
                onCancel={clearDeleteRequest}
                onConfirm={handleConfirmDelete}
            />

            <TimelineCommandContextMenu uiScale={uiScale} menu={contextMenu} />
        </div>
    );
}

import { useMemo, useState } from 'react';
import type { ScriptPath } from '../../utils/scriptPathUtils';

import { useScriptStore } from '../../store/useScriptStore';
import { useEditorStore } from '../../store/useEditorStore';
import { createDefaultCommand, getPlugin, getAllPlugins } from '../../editor/commandPlugins';
import { hasLikelyIssue } from '../../editor/likelyIssues';
import { editorTheme as t } from '../../theme/editorTheme';

import { useTimelineSelection } from './timeline/useTimelineSelection';
import { useTimelineDragDrop } from './timeline/useTimelineDragDrop';
import { TimelineNode } from './timeline/TimelineNode';
import { TimelineHeader } from './timeline/TimelineHeader';
import { TimelineCommandBar } from './timeline/TimelineCommandBar';
import { TimelineDropZone } from './timeline/TimelineDropZone';
import { TimelineEmptyState } from './timeline/TimelineEmptyState';
import { TimelineSearchBar } from './timeline/TimelineSearchBar';
import { ConfirmDialog } from '../common/ConfirmDialog';

function pathKey(path: ScriptPath) {
    return path.join('.');
}

function nodeSearchText(node: any): string {
    if (!node || typeof node !== 'object') return '';
    return [
        node.type,
        node.text,
        node.name,
        node.assetUrl,
        node.label,
        node.to,
        node.scene,
        node.id,
        node.key,
    ]
        .filter((v) => typeof v === 'string' || typeof v === 'number')
        .join(' ')
        .toLowerCase();
}

function matchesNodeSelf(node: any, query: string): boolean {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return nodeSearchText(node).includes(q);
}

function nodeOrDescendantMatches(node: any, query: string): boolean {
    if (!query.trim()) return true;
    if (!node || typeof node !== 'object') return false;

    if (matchesNodeSelf(node, query)) return true;

    const plugin = getPlugin(node.type || '');
    const branches = plugin.getBranches?.(node) ?? [];

    for (const branch of branches) {
        for (const child of branch.nodes ?? []) {
            if (nodeOrDescendantMatches(child, query)) return true;
        }
    }

    return false;
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

    const { selectedNodePaths, selectedKeys, onNodeClick } = useTimelineSelection();
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
        scopePath,
        popScope,
        resetScope,
        deleteNodeByPath,
        deleteNodesByPaths,
    } = useScriptStore();

    const allPlugins = useMemo(() => getAllPlugins(), []);
    const commandMenuItems = useMemo(
        () => allPlugins.map((p) => ({ type: p.type, label: p.label, icon: p.icon(14 * uiScale) })),
        [allPlugins, uiScale]
    );
    const quickTypes = useMemo(() => quickCommandTypes.filter((tt) => !!getPlugin(tt)), [quickCommandTypes]);

    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const [query, setQuery] = useState('');

    const isSearching = query.trim().length > 0;
    const rootNodes = useMemo(() => (Array.isArray(rootScript) ? rootScript : []), [rootScript]);

    const visibleRoot = useMemo(
        () =>
            rootNodes
                .map((node, index) => ({ node, index }))
                .filter(({ node }) => nodeOrDescendantMatches(node, query)),
        [rootNodes, query]
    );

    const toggleCollapse = (path: ScriptPath) => {
        const key = pathKey(path);
        setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const handleDeleteRootNode = (e: React.MouseEvent, index: number) => {
        e.stopPropagation();
        requestDelete([[index]], 'click');
    };

    const handleConfirmDelete = () => {
        const req = useEditorStore.getState().pendingDeleteRequest;
        if (!req || req.paths.length === 0) {
            clearDeleteRequest();
            return;
        }

        if (req.paths.length > 1) {
            deleteNodesByPaths(req.paths);
        } else {
            deleteNodeByPath(req.paths[0]);
        }

        clearSelection();
        clearDeleteRequest();
    };

    const getQuickMeta = (type: string) => {
        const p = getPlugin(type);
        return {
            icon: p.icon(14 * uiScale),
            title: p.label,
            bg: p.quickColor?.bg ?? '#333',
            border: p.quickColor?.border ?? '#444',
        };
    };

    const renderNode = (
        node: any,
        nodePath: ScriptPath,
        parentArrayPath: ScriptPath,
        indexInParent: number,
        depth: number
    ): React.ReactNode => {
        const nodePrefix = nodePath.join('.');
        const hasValidationError = Object.keys(validationErrors).some(
            (k) => k === nodePrefix || k.startsWith(nodePrefix + '.')
        );

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
                hasLikelyIssue={hasLikelyIssue(node)}
                isCollapsed={isSearching ? false : !!collapsed[pathKey(nodePath)]}
                onToggleCollapse={toggleCollapse}
                dropIndicator={dropIndicator}
                sameArrayPath={sameArrayPath}
                onClickNode={onNodeClick}
                onDragStart={handleNodeDragStart}
                onDragOver={handleNodeDragOver}
                onDrop={handleNodeDrop}
                onDragEnd={handleDragEnd}
                onDeleteRoot={handleDeleteRootNode}
                onPlayFrom={triggerPlayFrom}
                renderChild={renderNode}
                dragDisabled={isSearching}
            />
        );
    };

    return (
        <div
            style={{
                padding: `${8 * uiScale}px`,
                height: '100%',
                backgroundColor: t.bg.app,
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <TimelineHeader
                uiScale={uiScale}
                scopePath={scopePath}
                selectedCount={selectedNodePaths.length}
                onResetScope={resetScope}
                onPopScope={popScope}
            />

            <TimelineCommandBar
                uiScale={uiScale}
                commandMenuItems={commandMenuItems}
                quickTypes={quickTypes}
                onAdd={(type) => addNode(createDefaultCommand(type))}
                getQuickMeta={getQuickMeta}
            />

            <TimelineSearchBar
                uiScale={uiScale}
                query={query}
                onChangeQuery={setQuery}
                shown={visibleRoot.length}
                total={rootNodes.length}
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
        </div>
    );
}
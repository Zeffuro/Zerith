import { useMemo, useState } from 'react';
import type { ScriptPath } from '../../utils/scriptPathUtils';

import { useScriptStore } from '../../store/useScriptStore';
import { useEditorStore } from '../../store/useEditorStore';
import { createDefaultCommand, getPlugin, getAllPlugins } from '../../editor/commandPlugins';
import { editorTheme as t } from '../../theme/editorTheme';

import { useTimelineSelection } from './timeline/useTimelineSelection';
import { useTimelineDragDrop } from './timeline/useTimelineDragDrop';
import { TimelineNode } from './timeline/TimelineNode';
import { TimelineHeader } from './timeline/TimelineHeader';
import { TimelineCommandBar } from './timeline/TimelineCommandBar';
import { TimelineDropZone } from './timeline/TimelineDropZone';
import { TimelineEmptyState } from './timeline/TimelineEmptyState';

function pathKey(path: ScriptPath) {
    return path.join('.');
}

export function Timeline() {
    const uiScale = useEditorStore((state) => state.uiScale);
    const quickCommandTypes = useEditorStore((state) => state.quickCommandTypes);
    const triggerPlayFrom = useEditorStore((state) => state.triggerPlayFrom);
    const validationErrors = useEditorStore((state) => state.validationErrors);

    const { selectedNodePaths, selectedKeys, onNodeClick } = useTimelineSelection();
    const { dropIndicator, sameArrayPath, handleNodeDragStart, handleNodeDragOver, handleNodeDrop, handleDragEnd } =
        useTimelineDragDrop();

    const { rootScript, selectedNodeIndex, addNode, deleteNode, scopePath, popScope, resetScope } = useScriptStore();

    const allPlugins = useMemo(() => getAllPlugins(), []);
    const commandMenuItems = useMemo(
        () => allPlugins.map((p) => ({ type: p.type, label: p.label, icon: p.icon(14 * uiScale) })),
        [allPlugins, uiScale]
    );
    const quickTypes = useMemo(() => quickCommandTypes.filter((tt) => !!getPlugin(tt)), [quickCommandTypes]);

    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const rootNodes = useMemo(() => (Array.isArray(rootScript) ? rootScript : []), [rootScript]);

    const toggleCollapse = (path: ScriptPath) => {
        const key = pathKey(path);
        setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const handleDeleteRootNode = (e: React.MouseEvent, index: number) => {
        e.stopPropagation();
        if (confirm('Delete this node?')) deleteNode(index);
    };

    const hasLikelyIssue = (node: any) => {
        if (!node || typeof node !== 'object' || typeof node.type !== 'string') return true;
        switch (node.type) {
            case 'dialogue': return typeof node.text !== 'string';
            case 'jump': return typeof node.to !== 'string' || node.to.trim() === '';
            case 'call': return typeof node.name !== 'string' || node.name.trim() === '';
            case 'background': return typeof node.assetUrl !== 'string' || node.assetUrl.trim() === '';
            case 'sfx': return typeof node.assetUrl !== 'string' || node.assetUrl.trim() === '';
            case 'label': return typeof node.name !== 'string' || node.name.trim() === '';
            case 'goto': return typeof node.label !== 'string' || node.label.trim() === '';
            case 'if': return !Array.isArray(node.then) || !Array.isArray(node.else);
            case 'while': return !Array.isArray(node.body);
            case 'for': return !Array.isArray(node.body);
            default: return false;
        }
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
        const hasValidationError = Object.keys(validationErrors).some((k) => k === nodePrefix || k.startsWith(nodePrefix + '.'));

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
                hasLikelyIssue={hasLikelyIssue}
                isCollapsed={!!collapsed[pathKey(nodePath)]}
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
            />
        );
    };

    return (
        <div style={{ padding: `${8 * uiScale}px`, height: '100%', backgroundColor: t.bg.app, display: 'flex', flexDirection: 'column' }}>
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

            <div className="zerith-scrollbar" style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: `${2 * uiScale}px`, userSelect: 'none', WebkitUserSelect: 'none' }}>
                {rootNodes.map((node, i) => renderNode(node, [i], [], i, 0))}

                <TimelineDropZone
                    uiScale={uiScale}
                    rootCount={rootNodes.length}
                    dropIndicator={dropIndicator}
                    sameArrayPath={sameArrayPath}
                    onDragOver={handleNodeDragOver}
                    onDrop={handleNodeDrop}
                    borderAccent={t.border.accent}
                />

                {rootNodes.length === 0 && <TimelineEmptyState />}
            </div>
        </div>
    );
}
import { useMemo, useState, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useScriptStore } from '../../store/useScriptStore';
import { useEditorStore } from '../../store/useEditorStore';
import { Trash2, Home, ChevronRight, ChevronDown } from 'lucide-react';
import * as React from "react";
import type { ScriptPath } from '../../utils/scriptPathUtils';
import { createDefaultCommand, getPlugin, getAllPlugins } from '../../editor/commandPlugins';
import { AddCommandMenu } from "./AddCommandMenu.tsx";

function pathKey(path: ScriptPath) {
    return path.join('.');
}

function samePath(a: ScriptPath | null, b: ScriptPath) {
    return !!a && a.length === b.length && a.every((v, i) => v === b[i]);
}

export function Timeline() {
    const uiScale = useEditorStore(state => state.uiScale);
    const quickCommandTypes = useEditorStore(state => state.quickCommandTypes);

    const {
        rootScript, selectedNodePath, setSelectedNodePath,
        selectedNodeIndex, setSelectedNode,
        addNode, deleteNode,
        scopePath, popScope, resetScope,
        moveNodeByPath
    } = useScriptStore();

    const allPlugins = useMemo(() => getAllPlugins(), []);
    const commandMenuItems = useMemo(
        () => allPlugins.map((p) => ({
            type: p.type,
            label: p.label,
            icon: p.icon(14 * uiScale),
        })),
        [allPlugins, uiScale]
    );

    const quickTypes = useMemo(
        () => quickCommandTypes.filter((t) => !!getPlugin(t)),
        [quickCommandTypes]
    );

    const dragSourceRef = useRef<ScriptPath | null>(null);
    const [dropIndicator, setDropIndicator] = useState<{ arrayPath: ScriptPath; index: number } | null>(null);
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

    const sameArrayPath = (a: ScriptPath, b: ScriptPath) =>
        a.length === b.length && a.every((v, i) => v === b[i]);

    const isDescendantPath = (possibleDescendant: ScriptPath, ancestor: ScriptPath) =>
        possibleDescendant.length > ancestor.length &&
        ancestor.every((v, i) => possibleDescendant[i] === v);

    const toggleCollapse = (path: ScriptPath) => {
        const key = pathKey(path);
        setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleNodeDragStart = (e: React.DragEvent, nodePath: ScriptPath) => {
        dragSourceRef.current = nodePath;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", pathKey(nodePath));
    };

    const handleNodeDragOver = (e: React.DragEvent, arrayPath: ScriptPath, index: number) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        setDropIndicator({ arrayPath, index });
    };

    const handleNodeDrop = (e: React.DragEvent, arrayPath: ScriptPath, index: number) => {
        e.preventDefault();
        e.stopPropagation();

        const source = dragSourceRef.current;
        dragSourceRef.current = null;

        if (!source) {
            setDropIndicator(null);
            return;
        }

        if (isDescendantPath(arrayPath, source)) {
            setDropIndicator(null);
            return;
        }

        moveNodeByPath(source, arrayPath, index);
        setDropIndicator(null);
    };

    const handleDragEnd = () => {
        dragSourceRef.current = null;
        setDropIndicator(null);
    };

    const handleDeleteRootNode = (e: React.MouseEvent, index: number) => {
        e.stopPropagation();
        if (confirm('Delete this node?')) {
            deleteNode(index);
        }
    };

    const getIcon = (type: string) => {
        const size = 14 * uiScale;
        return getPlugin(type).icon(size);
    };

    function getBranches(node: any): Array<{ label: string; path: ScriptPath; nodes: any[] }> {
        if (!node?.type) return [];
        return getPlugin(node.type).getBranches?.(node) ?? [];
    }

    const getSummary = (node: any) => {
        const p = getPlugin(node?.type || '');
        return p.getSummary?.(node) || (node?.id || node?.assetUrl || node?.name || node?.scene || node?.key || '');
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

    const rootNodes = useMemo(() => Array.isArray(rootScript) ? rootScript : [], [rootScript]);

    const renderNode = (
        node: any,
        nodePath: ScriptPath,
        parentArrayPath: ScriptPath,
        indexInParent: number,
        depth: number
    ): React.ReactNode => {
        const key = pathKey(nodePath);
        const selected = samePath(selectedNodePath, nodePath);
        const branches = getBranches(node);
        const hasBranches = branches.length > 0;
        const isCollapsed = collapsed[key];

        return (
            <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: `${2 * uiScale}px` }}>
                <div
                    draggable
                    onDragStart={(e) => handleNodeDragStart(e, nodePath)}
                    onDragOver={(e) => handleNodeDragOver(e, parentArrayPath, indexInParent)}
                    onDrop={(e) => handleNodeDrop(e, parentArrayPath, indexInParent)}
                    onDragEnd={handleDragEnd}
                    onClick={() => {
                        setSelectedNodePath(nodePath);
                        if (nodePath.length === 1 && typeof nodePath[0] === 'number') {
                            setSelectedNode(nodePath[0] as number);
                        }
                    }}
                    style={{
                        marginLeft: `${depth * 16 * uiScale}px`,
                        padding: `${6 * uiScale}px ${10 * uiScale}px`,
                        backgroundColor: selected ? '#04395e' : '#252526',
                        borderLeft: `${3 * uiScale}px solid ${selected ? '#007fd4' : 'transparent'}`,
                        borderTop:
                            dropIndicator &&
                            sameArrayPath(dropIndicator.arrayPath, parentArrayPath) &&
                            dropIndicator.index === indexInParent
                                ? '2px solid #007fd4'
                                : '2px solid transparent',
                        borderRadius: '2px',
                        fontSize: 'inherit',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'grab',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: `${8 * uiScale}px`, flexGrow: 1, overflow: 'hidden' }}>
                        {hasBranches ? (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleCollapse(nodePath);
                                }}
                                style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', padding: 0 }}
                            >
                                {isCollapsed ? <ChevronRight size={12 * uiScale} /> : <ChevronDown size={12 * uiScale} />}
                            </button>
                        ) : (
                            <span style={{ width: `${12 * uiScale}px` }} />
                        )}

                        <div style={{ color: '#555', fontSize: '0.8em' }}>:::</div>
                        {getIcon(node.type)}
                        <span style={{ fontWeight: 'bold', color: '#fff' }}>{node.type}</span>
                        <span style={{ color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {getSummary(node)}
                        </span>
                    </div>
                    {hasLikelyIssue(node) && (
                        <span title="This node looks incomplete/invalid" style={{ display: 'flex', alignItems: 'center' }}>
                            <AlertTriangle size={12 * uiScale} color="#f59e0b" />
                        </span>
                    )}
                    {depth === 0 && selectedNodeIndex === nodePath[0] && (
                        <button
                            onClick={(e) => handleDeleteRootNode(e, nodePath[0] as number)}
                            style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: '2px' }}
                        >
                            <Trash2 size={12 * uiScale} />
                        </button>
                    )}
                </div>

                {hasBranches && !isCollapsed && (
                    <>
                        {branches.map((branch, bIdx) => {
                            const branchArrayPath = [...nodePath, ...branch.path];
                            const labelColor = bIdx % 2 === 0 ? '#4ec9b0' : '#f59e0b';

                            return (
                                <React.Fragment key={`${key}-branch-${bIdx}`}>
                                    <div
                                        style={{
                                            marginLeft: `${(depth + 1) * 16 * uiScale}px`,
                                            color: labelColor,
                                            fontSize: '0.8em',
                                            marginTop: bIdx === 0 ? 0 : `${4 * uiScale}px`
                                        }}
                                    >
                                        {branch.label}
                                    </div>

                                    {branch.nodes.map((child: any, i: number) =>
                                        renderNode(child, [...branchArrayPath, i], branchArrayPath, i, depth + 1)
                                    )}

                                    <div
                                        onDragOver={(e) => handleNodeDragOver(e, branchArrayPath, branch.nodes.length)}
                                        onDrop={(e) => handleNodeDrop(e, branchArrayPath, branch.nodes.length)}
                                        style={{
                                            marginLeft: `${(depth + 1) * 16 * uiScale}px`,
                                            height: `${6 * uiScale}px`,
                                            borderTop:
                                                dropIndicator &&
                                                sameArrayPath(dropIndicator.arrayPath, branchArrayPath) &&
                                                dropIndicator.index === branch.nodes.length
                                                    ? '2px solid #007fd4'
                                                    : '2px solid transparent',
                                        }}
                                    />
                                </React.Fragment>
                            );
                        })}
                    </>
                )}
            </div>
        );
    };

    return (
        <div style={{ padding: `${8 * uiScale}px`, height: '100%', backgroundColor: '#1e1e1e', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #333', color: '#888', fontSize: '0.85em' }}>
                <button onClick={resetScope} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: scopePath.length === 0 ? '#fff' : '#888' }}>
                    <Home size={14 * uiScale} />
                </button>

                {scopePath.length > 0 && (
                    <>
                        {scopePath.map((part, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                                <ChevronRight size={12 * uiScale} />
                                <span style={{ color: i === scopePath.length - 1 ? '#fff' : '#888' }}>
                                    {typeof part === 'number' ? `Node ${part}` : part}
                                </span>
                            </div>
                        ))}
                        <button onClick={popScope} style={{ marginLeft: 'auto', background: '#333', border: 'none', color: '#ccc', borderRadius: '3px', padding: '2px 6px', fontSize: '10px', cursor: 'pointer' }}>
                            UP
                        </button>
                    </>
                )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: `${4 * uiScale}px`, marginBottom: `${12 * uiScale}px` }}>
                <AddCommandMenu uiScale={uiScale} onAdd={(type) => addNode(createDefaultCommand(type))} items={commandMenuItems} />
                {quickTypes.map((type) => {
                    const p = getPlugin(type);
                    return (
                        <QuickBtn
                            key={type}
                            onClick={() => addNode(createDefaultCommand(type))}
                            icon={p.icon(14 * uiScale)}
                            title={p.label}
                            scale={uiScale}
                            bg={p.quickColor?.bg ?? '#333'}
                            border={p.quickColor?.border ?? '#444'}
                        />
                    );
                })}
            </div>

            <div style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: `${2 * uiScale}px`, userSelect: 'none', WebkitUserSelect: 'none' }}>
                {rootNodes.map((node, i) => renderNode(node, [i], [], i, 0))}

                <div
                    onDragOver={(e) => handleNodeDragOver(e, [], rootNodes.length)}
                    onDrop={(e) => handleNodeDrop(e, [], rootNodes.length)}
                    style={{
                        height: `${8 * uiScale}px`,
                        borderTop:
                            dropIndicator &&
                            sameArrayPath(dropIndicator.arrayPath, []) &&
                            dropIndicator.index === rootNodes.length
                                ? '2px solid #007fd4'
                                : '2px solid transparent',
                    }}
                />

                {rootNodes.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#444', padding: '20px', fontStyle: 'italic', fontSize: '0.9em' }}>
                        Empty Block
                    </div>
                )}
            </div>
        </div>
    );
}

function QuickBtn({ onClick, icon, title, scale, bg = '#333', border = '#444' }: any) {
    return (
        <button
            onClick={onClick}
            title={title}
            style={{
                background: bg,
                border: `1px solid ${border}`,
                color: '#ccc',
                borderRadius: '3px',
                padding: `${6 * scale}px`,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}
        >
            {icon}
        </button>
    );
}
import { useMemo, useState, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useScriptStore } from '../../store/useScriptStore';
import { useEditorStore } from '../../store/useEditorStore';
import {
    MessageSquare, Image as ImageIcon, Music, Gamepad2,
    ArrowRightCircle, GitFork, User, FileAudio, Workflow, Trash2,
    Home, ChevronRight, ChevronDown
} from 'lucide-react';
import * as React from "react";
import type { ScriptPath } from '../../utils/scriptPathUtils';

function pathKey(path: ScriptPath) {
    return path.join('.');
}

function samePath(a: ScriptPath | null, b: ScriptPath) {
    return !!a && a.length === b.length && a.every((v, i) => v === b[i]);
}

export function Timeline() {
    const uiScale = useEditorStore(state => state.uiScale);
    const {
        rootScript, selectedNodePath, setSelectedNodePath,
        selectedNodeIndex, setSelectedNode,
        addNode, deleteNode,
        scopePath, popScope, resetScope,
        moveNodeByPath
    } = useScriptStore();

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

    const handleAddNode = (type: string) => {
        let newNode: any = { type };
        if (type === 'dialogue') newNode = { type, speaker: '???', text: '...' };
        if (type === 'sprite') newNode = { type, id: '', action: 'show' };
        if (type === 'bgm') newNode = { type, assetUrl: '', action: 'play', volume: 0.5 };
        if (type === 'choice') newNode = { type, choices: [{ text: 'Option 1', label: '' }] };
        if (type === 'call') newNode = { type, name: '' };
        if (type === 'if') newNode = { type, source: 'variable', key: '', op: 'eq', value: true, then: [], else: [] };

        addNode(newNode);
    };

    const handleDeleteRootNode = (e: React.MouseEvent, index: number) => {
        e.stopPropagation();
        if (confirm('Delete this node?')) {
            deleteNode(index);
        }
    };

    const getIcon = (type: string) => {
        const size = 14 * uiScale;
        switch (type) {
            case 'dialogue': return <MessageSquare size={size} color="#60a5fa" />;
            case 'background': return <ImageIcon size={size} color="#34d399" />;
            case 'sprite': return <User size={size} color="#a78bfa" />;
            case 'bgm': return <Music size={size} color="#f472b6" />;
            case 'sfx': return <FileAudio size={size} color="#f472b6" />;
            case 'choice': return <GitFork size={size} color="#fbbf24" />;
            case 'jump': return <ArrowRightCircle size={size} color="#fbbf24" />;
            case 'call': return <Workflow size={size} color="#f472b6" />;
            case 'if': return <GitFork size={size} color="#4ec9b0" />;
            default: return <Gamepad2 size={size} color="#94a3b8" />;
        }
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
            case 'if':
                return !Array.isArray(node.then) || !Array.isArray(node.else);
            default:
                return false;
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
        const hasBranches = node?.type === 'if';
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
                            {node.type === 'dialogue' ? node.text : (node.id || node.assetUrl || node.name || node.scene || node.key)}
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
                        <div style={{ marginLeft: `${(depth + 1) * 16 * uiScale}px`, color: '#4ec9b0', fontSize: '0.8em' }}>
                            THEN
                        </div>

                        {(node.then || []).map((child: any, i: number) =>
                            renderNode(child, [...nodePath, 'then', i], [...nodePath, 'then'], i, depth + 1)
                        )}

                        <div
                            onDragOver={(e) => handleNodeDragOver(e, [...nodePath, 'then'], (node.then || []).length)}
                            onDrop={(e) => handleNodeDrop(e, [...nodePath, 'then'], (node.then || []).length)}
                            style={{
                                marginLeft: `${(depth + 1) * 16 * uiScale}px`,
                                height: `${6 * uiScale}px`,
                                borderTop:
                                    dropIndicator &&
                                    sameArrayPath(dropIndicator.arrayPath, [...nodePath, 'then']) &&
                                    dropIndicator.index === (node.then || []).length
                                        ? '2px solid #007fd4'
                                        : '2px solid transparent',
                            }}
                        />

                        <div style={{ marginLeft: `${(depth + 1) * 16 * uiScale}px`, color: '#f59e0b', fontSize: '0.8em', marginTop: `${4 * uiScale}px` }}>
                            ELSE
                        </div>

                        {(node.else || []).map((child: any, i: number) =>
                            renderNode(child, [...nodePath, 'else', i], [...nodePath, 'else'], i, depth + 1)
                        )}

                        <div
                            onDragOver={(e) => handleNodeDragOver(e, [...nodePath, 'else'], (node.else || []).length)}
                            onDrop={(e) => handleNodeDrop(e, [...nodePath, 'else'], (node.else || []).length)}
                            style={{
                                marginLeft: `${(depth + 1) * 16 * uiScale}px`,
                                height: `${6 * uiScale}px`,
                                borderTop:
                                    dropIndicator &&
                                    sameArrayPath(dropIndicator.arrayPath, [...nodePath, 'else']) &&
                                    dropIndicator.index === (node.else || []).length
                                        ? '2px solid #007fd4'
                                        : '2px solid transparent',
                            }}
                        />
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
                <QuickBtn onClick={() => handleAddNode('dialogue')} icon={<MessageSquare size={14 * uiScale} />} title="Dialogue" scale={uiScale} />
                <QuickBtn onClick={() => handleAddNode('sprite')} icon={<User size={14 * uiScale} />} title="Sprite" scale={uiScale} />
                <QuickBtn onClick={() => handleAddNode('background')} icon={<ImageIcon size={14 * uiScale} />} title="BG" scale={uiScale} />
                <QuickBtn onClick={() => handleAddNode('call')} icon={<Workflow size={14 * uiScale} />} title="Macro" scale={uiScale} />
                <QuickBtn onClick={() => handleAddNode('bgm')} icon={<Music size={14 * uiScale} />} title="Music" scale={uiScale} />
                <QuickBtn onClick={() => handleAddNode('choice')} icon={<GitFork size={14 * uiScale} />} title="Choice" scale={uiScale} />
                <QuickBtn onClick={() => handleAddNode('jump')} icon={<ArrowRightCircle size={14 * uiScale} />} title="Jump" scale={uiScale} />
                <QuickBtn onClick={() => handleAddNode('if')} icon={<GitFork size={14 * uiScale} />} title="If Condition" scale={uiScale} />
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

function QuickBtn({ onClick, icon, title, scale }: any) {
    return (
        <button
            onClick={onClick}
            title={title}
            style={{
                background: '#333',
                border: '1px solid #444',
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
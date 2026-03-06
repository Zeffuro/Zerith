import { useState, useRef } from 'react';
import { useScriptStore } from '../../store/useScriptStore';
import { useEditorStore } from '../../store/useEditorStore';
import {
    MessageSquare, Image as ImageIcon, Music, Gamepad2,
    ArrowRightCircle, GitFork, User, FileAudio, Workflow, Trash2,
    Home, ChevronRight
} from 'lucide-react';
import * as React from "react";

export function Timeline() {
    const uiScale = useEditorStore(state => state.uiScale);
    const {
        getActiveScript, updateActiveScript, selectedNodeIndex,
        setSelectedNode, deleteNode, addNode,
        scopePath, popScope, resetScope
    } = useScriptStore();

    const script = getActiveScript();

    const dragItemRef = useRef<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    const handleDragStart = (e: React.DragEvent, index: number) => {
        dragItemRef.current = index;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", index.toString());
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        if (dragOverIndex !== index) setDragOverIndex(index);
    };

    const handleDrop = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        e.stopPropagation();
        const sourceIndex = dragItemRef.current;
        dragItemRef.current = null;
        setDragOverIndex(null);
        if (sourceIndex === null || sourceIndex === targetIndex) return;

        const newScript = [...script];
        const [movedItem] = newScript.splice(sourceIndex, 1);
        newScript.splice(targetIndex, 0, movedItem);
        updateActiveScript(newScript);

        if (selectedNodeIndex === sourceIndex) setSelectedNode(targetIndex);
        else if (selectedNodeIndex !== null) {
            if (selectedNodeIndex === targetIndex && sourceIndex > targetIndex) setSelectedNode(selectedNodeIndex + 1);
            else if (selectedNodeIndex === targetIndex && sourceIndex < targetIndex) setSelectedNode(selectedNodeIndex - 1);
        }
    };

    const handleDragEnd = () => {
        dragItemRef.current = null;
        setDragOverIndex(null);
    };

    const handleContainerDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleContainerDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.target === e.currentTarget && dragItemRef.current !== null) {
            const sourceIndex = dragItemRef.current;
            dragItemRef.current = null;
            setDragOverIndex(null);
            const targetIndex = script.length - 1;
            if (sourceIndex === targetIndex) return;
            const newScript = [...script];
            const[movedItem] = newScript.splice(sourceIndex, 1);
            newScript.push(movedItem);
            updateActiveScript(newScript);
        }
    };

    // --- Actions ---

    const handleAddNode = (type: string) => {
        let newNode: any = { type };
        if (type === 'dialogue') newNode = { type, speaker: '???', text: '...' };
        if (type === 'sprite') newNode = { type, id: '', action: 'show' };
        if (type === 'bgm') newNode = { type, assetUrl: '', action: 'play', volume: 0.5 };
        if (type === 'choice') newNode = { type, choices:[{ text: 'Option 1', label: '' }] };
        if (type === 'call') newNode = { type, name: '' }; // Macro

        addNode(newNode);
    };

    const handleDelete = (e: React.MouseEvent, index: number) => {
        e.stopPropagation();
        if (confirm('Delete this node?')) {
            deleteNode(index);
        }
    };

    const getIcon = (type: string) => {
        const size = 14 * uiScale;
        switch(type) {
            case 'dialogue': return <MessageSquare size={size} color="#60a5fa" />;
            case 'background': return <ImageIcon size={size} color="#34d399" />;
            case 'sprite': return <User size={size} color="#a78bfa" />;
            case 'bgm': return <Music size={size} color="#f472b6" />;
            case 'sfx': return <FileAudio size={size} color="#f472b6" />;
            case 'choice': return <GitFork size={size} color="#fbbf24" />;
            case 'jump': return <ArrowRightCircle size={size} color="#fbbf24" />;
            case 'call': return <Workflow size={size} color="#f472b6" />;
            default: return <Gamepad2 size={size} color="#94a3b8" />;
        }
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

            <div
                onDragOver={handleContainerDragOver}
                onDrop={handleContainerDrop}
                style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: `${2 * uiScale}px`, userSelect: 'none', WebkitUserSelect: 'none' }}
            >
                {script.map((node, i) => (
                    <div
                        key={i}
                        draggable
                        onDragStart={(e) => handleDragStart(e, i)}
                        onDragOver={(e) => handleDragOver(e, i)}
                        onDrop={(e) => handleDrop(e, i)}
                        onDragEnd={handleDragEnd}
                        onClick={() => setSelectedNode(i)}
                        style={{
                            padding: `${6 * uiScale}px ${10 * uiScale}px`,
                            backgroundColor: selectedNodeIndex === i ? '#04395e' : (dragOverIndex === i ? '#333' : '#252526'),
                            borderLeft: `${3 * uiScale}px solid ${selectedNodeIndex === i ? '#007fd4' : 'transparent'}`,
                            borderTop: dragOverIndex === i ? `2px solid #007fd4` : '2px solid transparent',
                            cursor: 'grab',
                            borderRadius: '2px',
                            fontSize: 'inherit',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}
                    >
                        <div style={{ pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: `${8 * uiScale}px`, flexGrow: 1, overflow: 'hidden' }}>
                            <div style={{ color: '#555', fontSize: '0.8em' }}>:::</div>
                            {getIcon(node.type)}
                            <span style={{ fontWeight: 'bold', color: '#fff' }}>{node.type}</span>
                            <span style={{ color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {node.type === 'dialogue' ? node.text : (node.id || node.assetUrl || node.name || node.scene)}
                            </span>
                        </div>

                        {selectedNodeIndex === i && (
                            <button
                                onClick={(e) => handleDelete(e, i)}
                                style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: '2px' }}
                            >
                                <Trash2 size={12 * uiScale} />
                            </button>
                        )}
                    </div>
                ))}
                {script.length === 0 && (
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
                background: '#333', border: '1px solid #444',
                color: '#ccc', borderRadius: '3px', padding: `${6 * scale}px`,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
        >
            {icon}
        </button>
    );
}
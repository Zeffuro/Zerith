import { useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import {
    MessageSquare, Image as ImageIcon, Music, Gamepad2,
    ArrowRightCircle, GitFork, User, FileAudio
} from 'lucide-react';
import * as React from "react";

export function Timeline() {
    const { script, updateScript, selectedNodeIndex, setSelectedNode, uiScale } = useProjectStore();
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    // --- Robust Drag & Drop ---

    const handleDragStart = (e: React.DragEvent, index: number) => {
        // We use dataTransfer to store the source index reliably
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", index.toString());
        // Optional: Set a custom drag image here if you want
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = "move";
        if (dragOverIndex !== index) {
            setDragOverIndex(index);
        }
    };

    const handleDragLeave = () => {
        // Optional: Clear drag over look if leaving the container
        // But usually unreliable on child elements, so we ignore for now
    };

    const handleDrop = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        setDragOverIndex(null);

        const sourceIndexStr = e.dataTransfer.getData("text/plain");
        if (!sourceIndexStr) return;

        const sourceIndex = parseInt(sourceIndexStr, 10);
        if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;

        const newScript = [...script];
        const [movedItem] = newScript.splice(sourceIndex, 1);
        newScript.splice(targetIndex, 0, movedItem);

        updateScript(newScript);

        // Maintain selection
        if (selectedNodeIndex === sourceIndex) {
            setSelectedNode(targetIndex);
        } else if (selectedNodeIndex === targetIndex && sourceIndex > targetIndex) {
            setSelectedNode(selectedNodeIndex + 1);
        } else if (selectedNodeIndex === targetIndex && sourceIndex < targetIndex) {
            setSelectedNode(selectedNodeIndex - 1);
        }
    };

    const handleDragEnd = () => {
        setDragOverIndex(null);
    };

    const addNode = (type: string) => {
        let newNode: any = { type };
        if (type === 'dialogue') newNode = { type, speaker: '???', text: '...' };
        if (type === 'sprite') newNode = { type, id: '', action: 'show' };
        if (type === 'bgm') newNode = { type, assetUrl: '', action: 'play', volume: 0.5 };
        if (type === 'choice') newNode = { type, choices: [{ text: 'Option 1', label: '' }] };

        const index = selectedNodeIndex !== null ? selectedNodeIndex + 1 : script.length;
        const newScript = [...script];
        newScript.splice(index, 0, newNode);
        updateScript(newScript);
        setSelectedNode(index);
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
            default: return <Gamepad2 size={size} color="#94a3b8" />;
        }
    };

    return (
        <div style={{ padding: `${8 * uiScale}px`, height: '100%', backgroundColor: '#1e1e1e', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: `${4 * uiScale}px`, marginBottom: `${12 * uiScale}px` }}>
                <QuickBtn onClick={() => addNode('dialogue')} icon={<MessageSquare size={14 * uiScale} />} title="Dialogue" scale={uiScale} />
                <QuickBtn onClick={() => addNode('sprite')} icon={<User size={14 * uiScale} />} title="Sprite" scale={uiScale} />
                <QuickBtn onClick={() => addNode('background')} icon={<ImageIcon size={14 * uiScale} />} title="BG" scale={uiScale} />
                <QuickBtn onClick={() => addNode('bgm')} icon={<Music size={14 * uiScale} />} title="Music" scale={uiScale} />
                <QuickBtn onClick={() => addNode('choice')} icon={<GitFork size={14 * uiScale} />} title="Choice" scale={uiScale} />
                <QuickBtn onClick={() => addNode('jump')} icon={<ArrowRightCircle size={14 * uiScale} />} title="Jump" scale={uiScale} />
            </div>

            <div style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: `${2 * uiScale}px` }}>
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
                            display: 'flex',
                            alignItems: 'center',
                            gap: `${8 * uiScale}px`,
                            userSelect: 'none',
                            WebkitUserSelect: 'none',
                            padding: `${6 * uiScale}px ${10 * uiScale}px`,
                            backgroundColor: selectedNodeIndex === i ? '#04395e' : (dragOverIndex === i ? '#333' : '#252526'),
                            borderLeft: `${3 * uiScale}px solid ${selectedNodeIndex === i ? '#007fd4' : 'transparent'}`,
                            borderTop: dragOverIndex === i ? `2px solid #007fd4` : '2px solid transparent',
                            cursor: 'grab',
                            borderRadius: '2px',
                            fontSize: 'inherit',
                        }}
                    >
                        <div style={{ cursor: 'grab', color: '#555', fontSize: '0.8em' }}>:::</div>
                        {getIcon(node.type)}
                        <span style={{ fontWeight: 'bold', color: '#fff' }}>{node.type}</span>
                        <span style={{ color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {node.type === 'dialogue' ? node.text : (node.id || node.assetUrl)}
                        </span>
                    </div>
                ))}
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
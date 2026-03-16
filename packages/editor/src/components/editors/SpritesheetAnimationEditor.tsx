import { type SpriteFrame } from 'core';
import { type DragEvent, useEffect, useMemo, useRef, useState } from 'react';

import { editorTheme as t } from '../../theme/editorTheme';
import { ConfirmDialog } from '../ConfirmDialog';
import { computeThumbnailCanvasMetrics, insertFrameAtIndex, reorderSequence } from './spritesheetEditorModel';

const FRAME_MIME = 'application/x-zerith-frame';
const SEQ_INDEX_MIME = 'application/x-zerith-sequence-index';

export type SpritesheetAnimationEditorProperties = {
    animations: Record<string, string[]>;
    frames: Record<string, SpriteFrame>;
    image: HTMLImageElement;
    onUpdateAnimations: (animations: Record<string, string[]>) => void;
    uiScale: number;
};

export function SpritesheetAnimationEditor({ animations, frames, image, onUpdateAnimations, uiScale }: SpritesheetAnimationEditorProperties) {
    const names = useMemo(() => Object.keys(animations), [animations]);
    const [selected, setSelected] = useState<string>();
    const [newName, setNewName] = useState('');
    const [fps, setFps] = useState(12);
    const [loop, setLoop] = useState(true);
    const [playing, setPlaying] = useState(false);
    const [previewIndex, setPreviewIndex] = useState(0);
    const [validationMessage, setValidationMessage] = useState<string>();
    const selectedAnimationName = selected && animations[selected] ? selected : names[0];
    const sequence = selectedAnimationName ? (animations[selectedAnimationName] ?? []) : [];
    const activePreviewIndex = sequence.length === 0 ? 0 : Math.min(previewIndex, sequence.length - 1);

    useEffect(() => {
        if (!playing || sequence.length === 0) return;
        const timer = globalThis.setInterval(() => {
            setPreviewIndex((current) => {
                const next = current + 1;
                if (next < sequence.length) return next;
                if (loop) return 0;
                setPlaying(false);
                return Math.max(0, sequence.length - 1);
            });
        }, Math.max(16, Math.round(1000 / fps)));
        return () => globalThis.clearInterval(timer);
    }, [fps, loop, playing, sequence.length]);

    const updateSequence = (nextSequence: string[]) => {
        if (!selectedAnimationName) return;
        onUpdateAnimations({ ...animations, [selectedAnimationName]: nextSequence });
    };

    const addAnimation = () => {
        const name = newName.trim();
        if (!name) return;
        if (animations[name]) {
            setValidationMessage(`Animation "${name}" already exists.`);
            return;
        }
        onUpdateAnimations({ ...animations, [name]: [] });
        setSelected(name);
        setNewName('');
    };

    const removeAnimation = () => {
        if (!selectedAnimationName) return;
        const next = { ...animations };
        delete next[selectedAnimationName];
        onUpdateAnimations(next);
        setPlaying(false);
        setPreviewIndex(0);
    };

    const handleDrop = (event: DragEvent, targetIndex: number) => {
        event.preventDefault();
        if (!selectedAnimationName) return;
        const sourceIndex = readDroppedIndex(event);
        if (sourceIndex !== undefined) {
            const next = reorderSequence(sequence, sourceIndex, targetIndex);
            if (next === sequence) return;
            updateSequence(next);
            return;
        }
        const frameName = readDroppedFrame(event);
        if (!frameName || !frames[frameName]) return;
        const next = insertFrameAtIndex(sequence, targetIndex, frameName);
        updateSequence(next);
    };

    return (
        <div style={{ display: 'grid', gap: 8, gridTemplateRows: 'auto auto auto minmax(0,1fr)', height: '100%' }}>
            <strong style={{ color: t.text.primary }}>Animations</strong>
            <div style={{ display: 'grid', gap: 6 }}>
                {names.length === 0 ? <div style={{ color: t.text.muted }}>No animations configured.</div> : undefined}
                {names.map((name) => (
                    <button
                        key={name}
                        onClick={() => {
                            setSelected(name);
                            setPlaying(false);
                            setPreviewIndex(0);
                        }}
                        style={{
                            background: selected === name ? t.bg.selected : t.bg.panel,
                            border: `1px solid ${selected === name ? t.accent.primary : t.border.input}`,
                            borderRadius: t.radius.sm,
                            color: t.text.normal,
                            cursor: 'pointer',
                            overflow: 'hidden',
                            padding: '6px 8px',
                            textAlign: 'left',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >{name}</button>
                ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
                <input
                    onChange={(event) => setNewName(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && addAnimation()}
                    placeholder="Animation name"
                    style={{ flex: 1, minWidth: 0 }}
                    value={newName}
                />
                <button onClick={addAnimation}>Add Animation</button>
                <button disabled={!selected} onClick={removeAnimation}>Remove Animation</button>
            </div>

            <div style={{ display: 'grid', gap: 8, minHeight: 0 }}>
                <div style={{ color: t.text.muted }}>{selectedAnimationName ? `${selectedAnimationName} (${sequence.length} frames)` : 'Select an animation.'}</div>
                <div
                    className="zerith-scrollbar"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => handleDrop(event, sequence.length)}
                    style={{ alignItems: 'center', background: t.bg.panel, border: `1px solid ${t.border.input}`, borderRadius: t.radius.sm, display: 'flex', gap: 6, minHeight: 70, overflowX: 'auto', padding: 6 }}
                >
                    {sequence.map((frameName, index) => (
                        <button
                            draggable
                            key={`${frameName}-${index}`}
                            onClick={() => setPreviewIndex(index)}
                            onDragOver={(event) => event.preventDefault()}
                            onDragStart={(event) => {
                                event.dataTransfer.effectAllowed = 'move';
                                event.dataTransfer.setData(SEQ_INDEX_MIME, `${index}`);
                            }}
                            onDrop={(event) => handleDrop(event, index)}
                            style={{ background: previewIndex === index ? t.bg.selected : t.bg.panelAlt, border: `1px solid ${previewIndex === index ? t.accent.primary : t.border.subtle}`, borderRadius: t.radius.sm, cursor: 'pointer', flex: '0 0 auto', minWidth: 56, padding: 4 }}
                            title={frameName}
                        >
                            <FrameThumb frame={frames[frameName]} image={image} uiScale={uiScale} />
                        </button>
                    ))}
                    {selectedAnimationName && sequence.length === 0 ? <div style={{ color: t.text.muted }}>Drag frames here.</div> : undefined}
                </div>

                <div style={{ alignItems: 'center', display: 'grid', gap: 8, gridTemplateColumns: '1fr auto' }}>
                    <label style={{ color: t.text.muted }}>FPS: {fps}<input max={60} min={1} onChange={(event) => setFps(Number(event.target.value))} type="range" value={fps} /></label>
                    <label style={{ color: t.text.muted }}><input checked={loop} onChange={(event) => setLoop(event.target.checked)} type="checkbox" /> Loop</label>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                    <button disabled={!selectedAnimationName || sequence.length === 0} onClick={() => setPlaying((value) => !value)}>{playing ? 'Pause' : 'Play'}</button>
                    <button disabled={!selectedAnimationName || sequence.length === 0} onClick={() => {
                        setPlaying(false);
                        setPreviewIndex(0);
                    }}>Stop</button>
                </div>
                <PreviewBox frame={frames[sequence[activePreviewIndex]]} image={image} uiScale={uiScale} />
            </div>

            <ConfirmDialog
                cancelText="Close"
                confirmText="OK"
                message={validationMessage ?? ''}
                onCancel={() => setValidationMessage(undefined)}
                onConfirm={() => setValidationMessage(undefined)}
                open={Boolean(validationMessage)}
                title="Animation Validation"
            />
        </div>
    );
}

function readDroppedFrame(event: DragEvent): string {
    return event.dataTransfer.getData(FRAME_MIME) || event.dataTransfer.getData('text/plain');
}

function readDroppedIndex(event: DragEvent): number | undefined {
    const raw = event.dataTransfer.getData(SEQ_INDEX_MIME);
    if (!raw) return undefined;
    const value = Number(raw);
    return Number.isInteger(value) ? value : undefined;
}

function drawBlank(canvas: HTMLCanvasElement) {
    canvas.width = 1;
    canvas.height = 1;
    canvas.style.width = '96px';
    canvas.style.height = '96px';
}

function drawFrame(canvas: HTMLCanvasElement, frame: SpriteFrame, image: HTMLImageElement, maxSize: number) {
    const context = canvas.getContext('2d');
    if (!context) return;
    const dpr = window.devicePixelRatio || 1;
    const { height, pixelHeight, pixelWidth, width } = computeThumbnailCanvasMetrics(frame, maxSize, dpr);
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.scale(dpr, dpr);
    context.imageSmoothingEnabled = false;
    try {
        context.drawImage(image, frame.x, frame.y, frame.w, frame.h, 0, 0, width, height);
    } catch {
        // Keep preview blank when frame bounds are outside the source image.
    }
}

function FrameThumb({ frame, image, uiScale }: { frame?: SpriteFrame; image: HTMLImageElement; uiScale: number }) {
    const reference = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        if (reference.current && frame) drawFrame(reference.current, frame, image, Math.max(24, Math.round(48 * uiScale)));
    }, [frame, image, uiScale]);
    return <canvas ref={reference} />;
}

function PreviewBox({ frame, image, uiScale }: { frame?: SpriteFrame; image: HTMLImageElement; uiScale: number }) {
    const reference = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        if (!reference.current) return;
        if (!frame) return drawBlank(reference.current);
        drawFrame(reference.current, frame, image, Math.max(32, Math.round(96 * uiScale)));
    }, [frame, image, uiScale]);
    return <div style={{ alignItems: 'center', background: t.bg.panel, border: `1px solid ${t.border.input}`, borderRadius: t.radius.sm, display: 'flex', height: 110, justifyContent: 'center', width: 110 }}><canvas ref={reference} /></div>;
}


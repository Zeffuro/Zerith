import { type SpriteFrame } from '@zeffuro/zerith-core';
import { ArrowLeft, ArrowRight, Film, Pause, Play, Plus, Square, Trash2 } from 'lucide-react';
import { type DragEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import { editorTheme as t } from '../../theme/editorTheme';
import { ConfirmDialog } from '../ConfirmDialog';
import {
    applySpritesheetButtonHover,
    applySpritesheetButtonPressed,
    resetSpritesheetButtonBackground,
    spritesheetButtonStyle,
} from './spritesheetButtonStyles';
import {
    computeThumbnailCanvasMetrics,
    insertFrameAtIndex,
    moveSequenceFrame,
    removeFrameAtIndex,
    removeMatchingSequenceFrames,
    reorderSequence,
    replaceFrameAtIndex,
} from './spritesheetEditorModel';

const FRAME_MIME = 'application/x-zerith-frame';
const SEQ_INDEX_MIME = 'application/x-zerith-sequence-index';

export type SpritesheetAnimationEditorProperties = {
    animations: Record<string, string[]>;
    frames: Record<string, SpriteFrame>;
    image: HTMLImageElement;
    onUpdateAnimations: (animations: Record<string, string[]>) => void;
    selectedFrameName?: string;
    uiScale: number;
};

export function SpritesheetAnimationEditor({
    animations,
    frames,
    image,
    onUpdateAnimations,
    selectedFrameName,
    uiScale,
}: SpritesheetAnimationEditorProperties) {
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
    const activeSequenceFrameName = sequence[activePreviewIndex];
    const canUseSelectedFrame = Boolean(selectedFrameName && frames[selectedFrameName]);
    const iconSize = Math.max(14, Math.round(15 * uiScale));

    useEffect(() => {
        if (selected && animations[selected]) return;
        setSelected(names[0]);
    }, [animations, names, selected]);

    useEffect(() => {
        setPreviewIndex((current) => sequence.length === 0 ? 0 : Math.min(current, sequence.length - 1));
    }, [selectedAnimationName, sequence.length]);

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

    const insertSelectedFrame = () => {
        if (!selectedAnimationName || !selectedFrameName || !frames[selectedFrameName]) return;
        const targetIndex = sequence.length === 0 ? 0 : activePreviewIndex + 1;
        updateSequence(insertFrameAtIndex(sequence, targetIndex, selectedFrameName));
        setPreviewIndex(targetIndex);
    };

    const moveSelectedSequenceFrame = (direction: -1 | 1) => {
        if (!selectedAnimationName || sequence.length === 0) return;
        const next = moveSequenceFrame(sequence, activePreviewIndex, direction);
        if (next === sequence) return;
        updateSequence(next);
        setPreviewIndex(activePreviewIndex + direction);
    };

    const replaceSelectedSequenceFrame = () => {
        if (!selectedAnimationName || !selectedFrameName || !frames[selectedFrameName] || sequence.length === 0) return;
        updateSequence(replaceFrameAtIndex(sequence, activePreviewIndex, selectedFrameName));
    };

    const removeSelectedSequenceFrame = () => {
        if (!selectedAnimationName || sequence.length === 0) return;
        const next = removeFrameAtIndex(sequence, activePreviewIndex);
        updateSequence(next);
        setPreviewIndex((current) => Math.max(0, Math.min(current, next.length - 1)));
    };

    const removeAllMatchingSelectedSequenceFrame = () => {
        if (!selectedAnimationName || !activeSequenceFrameName) return;
        const next = removeMatchingSequenceFrames(sequence, activeSequenceFrameName);
        updateSequence(next);
        setPreviewIndex((current) => Math.max(0, Math.min(current, next.length - 1)));
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
        setPreviewIndex(Math.max(0, Math.min(targetIndex, next.length - 1)));
    };

    return (
        <div style={{ display: 'grid', gap: 10, gridTemplateRows: 'auto auto auto auto minmax(0,1fr)', height: '100%' }}>
            <div style={{ alignItems: 'center', display: 'flex', gap: 8 }}>
                <Film color={t.accent.purple} size={iconSize} />
                <strong style={{ color: t.text.primary }}>Animations</strong>
                <span style={{ color: t.text.faint, fontSize: `${12 * uiScale}px`, marginLeft: 'auto' }}>{names.length}</span>
            </div>
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
                            onMouseDown={(event) => applySpritesheetButtonPressed(event, false, selectedAnimationName === name)}
                            onMouseEnter={(event) => applySpritesheetButtonHover(event, false, selectedAnimationName === name)}
                            onMouseLeave={(event) => resetSpritesheetButtonBackground(event, false, selectedAnimationName === name)}
                            onMouseUp={(event) => applySpritesheetButtonHover(event, false, selectedAnimationName === name)}
                        style={{
                            display: 'grid',
                            gap: 8,
                            gridTemplateColumns: 'minmax(0, 1fr) auto',
                            overflow: 'hidden',
                            textAlign: 'left',
                            ...spritesheetButtonStyle({ active: selectedAnimationName === name }),
                        }}
                        type="button"
                    >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                        <span style={{ color: t.text.faint }}>{animations[name]?.length ?? 0}</span>
                    </button>
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
                <button
                    onClick={addAnimation}
                    onMouseDown={(event) => applySpritesheetButtonPressed(event, false, false)}
                    onMouseEnter={(event) => applySpritesheetButtonHover(event, false, false)}
                    onMouseLeave={(event) => resetSpritesheetButtonBackground(event, false, false)}
                    onMouseUp={(event) => applySpritesheetButtonHover(event, false, false)}
                    style={spritesheetButtonStyle()}
                    title="Add animation"
                    type="button"
                >
                    <Plus size={iconSize} />
                    Add
                </button>
                <button
                    disabled={!selected}
                    onClick={removeAnimation}
                    onMouseDown={(event) => applySpritesheetButtonPressed(event, !selected, false)}
                    onMouseEnter={(event) => applySpritesheetButtonHover(event, !selected, false)}
                    onMouseLeave={(event) => resetSpritesheetButtonBackground(event, !selected, false)}
                    onMouseUp={(event) => applySpritesheetButtonHover(event, !selected, false)}
                    style={spritesheetButtonStyle({ disabled: !selected })}
                    title="Remove selected animation"
                    type="button"
                >
                    <Trash2 size={iconSize} />
                    Remove
                </button>
            </div>

            <div style={{ background: t.bg.panel, border: `1px solid ${t.border.input}`, borderRadius: t.radius.sm, color: t.text.muted, display: 'grid', gap: 6, padding: 8 }}>
                <div style={{ display: 'grid', gap: 4, gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        Sheet frame: {selectedFrameName && frames[selectedFrameName] ? selectedFrameName : 'select a frame'}
                    </span>
                    <span>{selectedFrameName && frames[selectedFrameName] ? `${frames[selectedFrameName].w}x${frames[selectedFrameName].h}` : ''}</span>
                </div>
                <div style={{ display: 'grid', gap: 6, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                    <SequenceActionButton
                        disabled={!selectedAnimationName || !canUseSelectedFrame}
                        onClick={insertSelectedFrame}
                        title="Insert the selected sheet frame after the active animation frame"
                        uiScale={uiScale}
                    >
                        <Plus size={iconSize} />
                        Add selected
                    </SequenceActionButton>
                    <SequenceActionButton
                        disabled={!selectedAnimationName || !canUseSelectedFrame || sequence.length === 0}
                        onClick={replaceSelectedSequenceFrame}
                        title="Replace the active animation frame with the selected sheet frame"
                        uiScale={uiScale}
                    >
                        Replace active
                    </SequenceActionButton>
                </div>
            </div>

            <div style={{ display: 'grid', gap: 8, minHeight: 0 }}>
                <div style={{ color: t.text.muted }}>{selectedAnimationName ? `${selectedAnimationName} (${sequence.length} frames)` : 'Select an animation.'}</div>
                <div
                    className="zerith-scrollbar"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => handleDrop(event, sequence.length)}
                    style={{ alignItems: 'stretch', background: t.bg.panel, border: `1px solid ${t.border.input}`, borderRadius: t.radius.sm, display: 'flex', gap: 6, minHeight: 104, overflowX: 'auto', padding: 6 }}
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
                            onMouseDown={(event) => applySpritesheetButtonPressed(event, false, previewIndex === index)}
                            onMouseEnter={(event) => applySpritesheetButtonHover(event, false, previewIndex === index)}
                            onMouseLeave={(event) => resetSpritesheetButtonBackground(event, false, previewIndex === index)}
                            onMouseUp={(event) => applySpritesheetButtonHover(event, false, previewIndex === index)}
                            style={{
                                alignItems: 'center',
                                display: 'grid',
                                flex: '0 0 auto',
                                gap: 4,
                                gridTemplateRows: 'auto auto',
                                minWidth: 92,
                                padding: 4,
                                position: 'relative',
                                ...spritesheetButtonStyle({ active: previewIndex === index }),
                            }}
                            title={frameName}
                            type="button"
                        >
                            <FrameThumb frame={frames[frameName]} image={image} uiScale={uiScale} />
                            <span style={{ color: previewIndex === index ? t.text.primary : t.text.muted, fontSize: `${11 * uiScale}px`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {index + 1}. {frameName}
                            </span>
                        </button>
                    ))}
                    {selectedAnimationName && sequence.length === 0 ? <div style={{ color: t.text.muted }}>Drag frames here.</div> : undefined}
                </div>

                <div style={{ background: t.bg.panel, border: `1px solid ${t.border.input}`, borderRadius: t.radius.sm, display: 'grid', gap: 6, padding: 8 }}>
                    <div style={{ color: t.text.muted, display: 'grid', gap: 4, gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            Active: {activeSequenceFrameName ?? 'none'}
                        </span>
                        <span>{sequence.length > 0 ? `${activePreviewIndex + 1}/${sequence.length}` : ''}</span>
                    </div>
                    <div style={{ display: 'grid', gap: 6, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                        <SequenceActionButton
                            disabled={activePreviewIndex <= 0 || sequence.length === 0}
                            onClick={() => moveSelectedSequenceFrame(-1)}
                            title="Move active frame left"
                            uiScale={uiScale}
                        >
                            <ArrowLeft size={iconSize} />
                            Left
                        </SequenceActionButton>
                        <SequenceActionButton
                            disabled={activePreviewIndex >= sequence.length - 1 || sequence.length === 0}
                            onClick={() => moveSelectedSequenceFrame(1)}
                            title="Move active frame right"
                            uiScale={uiScale}
                        >
                            <ArrowRight size={iconSize} />
                            Right
                        </SequenceActionButton>
                        <SequenceActionButton
                            disabled={!selectedAnimationName || sequence.length === 0}
                            onClick={removeSelectedSequenceFrame}
                            title="Remove active animation frame"
                            uiScale={uiScale}
                        >
                            <Trash2 size={iconSize} />
                            Remove one
                        </SequenceActionButton>
                        <SequenceActionButton
                            disabled={!selectedAnimationName || !activeSequenceFrameName}
                            onClick={removeAllMatchingSelectedSequenceFrame}
                            title="Remove every occurrence of the active frame from this animation"
                            uiScale={uiScale}
                        >
                            <Trash2 size={iconSize} />
                            Remove all
                        </SequenceActionButton>
                    </div>
                </div>

                <div style={{ alignItems: 'center', display: 'grid', gap: 8, gridTemplateColumns: '1fr auto' }}>
                    <label style={{ color: t.text.muted }}>FPS: {fps}<input max={60} min={1} onChange={(event) => setFps(Number(event.target.value))} type="range" value={fps} /></label>
                    <label style={{ color: t.text.muted }}><input checked={loop} onChange={(event) => setLoop(event.target.checked)} type="checkbox" /> Loop</label>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                    <button
                        disabled={!selectedAnimationName || sequence.length === 0}
                        onClick={() => setPlaying((value) => !value)}
                        onMouseDown={(event) => applySpritesheetButtonPressed(event, !selectedAnimationName || sequence.length === 0, false)}
                        onMouseEnter={(event) => applySpritesheetButtonHover(event, !selectedAnimationName || sequence.length === 0, false)}
                        onMouseLeave={(event) => resetSpritesheetButtonBackground(event, !selectedAnimationName || sequence.length === 0, false)}
                        onMouseUp={(event) => applySpritesheetButtonHover(event, !selectedAnimationName || sequence.length === 0, false)}
                        style={spritesheetButtonStyle({ disabled: !selectedAnimationName || sequence.length === 0 })}
                        title={playing ? 'Pause animation preview' : 'Play animation preview'}
                        type="button"
                    >
                        {playing ? <Pause size={iconSize} /> : <Play size={iconSize} />}
                        {playing ? 'Pause' : 'Play'}
                    </button>
                    <button
                        disabled={!selectedAnimationName || sequence.length === 0}
                        onClick={() => {
                            setPlaying(false);
                            setPreviewIndex(0);
                        }}
                        onMouseDown={(event) => applySpritesheetButtonPressed(event, !selectedAnimationName || sequence.length === 0, false)}
                        onMouseEnter={(event) => applySpritesheetButtonHover(event, !selectedAnimationName || sequence.length === 0, false)}
                        onMouseLeave={(event) => resetSpritesheetButtonBackground(event, !selectedAnimationName || sequence.length === 0, false)}
                        onMouseUp={(event) => applySpritesheetButtonHover(event, !selectedAnimationName || sequence.length === 0, false)}
                        style={spritesheetButtonStyle({ disabled: !selectedAnimationName || sequence.length === 0 })}
                        title="Stop animation preview"
                        type="button"
                    >
                        <Square size={iconSize} />
                        Stop
                    </button>
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

function readDroppedFrame(event: DragEvent): string {
    return event.dataTransfer.getData(FRAME_MIME) || event.dataTransfer.getData('text/plain');
}

function readDroppedIndex(event: DragEvent): number | undefined {
    const raw = event.dataTransfer.getData(SEQ_INDEX_MIME);
    if (!raw) return undefined;
    const value = Number(raw);
    return Number.isInteger(value) ? value : undefined;
}

function SequenceActionButton({
    children,
    disabled,
    onClick,
    title,
    uiScale,
}: {
    children: ReactNode;
    disabled: boolean;
    onClick: () => void;
    title: string;
    uiScale: number;
}) {
    return (
        <button
            disabled={disabled}
            onClick={onClick}
            onMouseDown={(event) => applySpritesheetButtonPressed(event, disabled, false)}
            onMouseEnter={(event) => applySpritesheetButtonHover(event, disabled, false)}
            onMouseLeave={(event) => resetSpritesheetButtonBackground(event, disabled, false)}
            onMouseUp={(event) => applySpritesheetButtonHover(event, disabled, false)}
            style={{
                justifyContent: 'center',
                minHeight: Math.max(28, Math.round(28 * uiScale)),
                ...spritesheetButtonStyle({ disabled }),
            }}
            title={title}
            type="button"
        >
            {children}
        </button>
    );
}

import { type SpriteFrame } from '@zeffuro/zerith-core';
import { Image as ImageIcon, Plus, Rows3, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { editorTheme as t } from '../../theme/editorTheme';
import { ConfirmDialog } from '../ConfirmDialog';
import {
    applySpritesheetButtonHover,
    applySpritesheetButtonPressed,
    resetSpritesheetButtonBackground,
    spritesheetButtonStyle,
} from './spritesheetButtonStyles';
import {
    computeFrameListMetrics,
    computeThumbnailCanvasMetrics,
    type SpritesheetFrameListDensity,
} from './spritesheetEditorModel';

const FRAME_MIME = 'application/x-zerith-frame';

export type SpritesheetFrameListProperties = {
    frames: Record<string, SpriteFrame>;
    image: HTMLImageElement;
    onAddFrame?: () => void;
    onRemoveFrame?: (name: string) => void;
    onSelectFrame: (name: string) => void;
    selectedFrame?: string;
    uiScale: number;
};

type FrameThumbnailProperties = {
    boxSize: number;
    frame: SpriteFrame;
    image: HTMLImageElement;
    maxSize: number;
};

export function SpritesheetFrameList({
    frames,
    image,
    onAddFrame,
    onRemoveFrame,
    onSelectFrame,
    selectedFrame,
    uiScale,
}: SpritesheetFrameListProperties) {
    const frameNames = useMemo(() => Object.keys(frames), [frames]);
    const [density, setDensity] = useState<SpritesheetFrameListDensity>('comfortable');
    const [filter, setFilter] = useState('');
    const [pendingFrameRemoval, setPendingFrameRemoval] = useState<string>();
    const metrics = useMemo(() => computeFrameListMetrics(density, uiScale), [density, uiScale]);
    const filteredFrameNames = useMemo(() => {
        const query = filter.trim().toLowerCase();
        if (!query) return frameNames;
        return frameNames.filter((name) => name.toLowerCase().includes(query));
    }, [filter, frameNames]);
    const iconSize = Math.max(14, Math.round(15 * uiScale));

    const confirmRemoveFrame = () => {
        if (!pendingFrameRemoval || !onRemoveFrame) return;
        onRemoveFrame(pendingFrameRemoval);
        setPendingFrameRemoval(undefined);
    };

    return (
        <div style={{ display: 'grid', gap: 10, gridTemplateRows: 'auto minmax(0, 1fr) auto', height: '100%' }}>
            <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ alignItems: 'center', display: 'flex', gap: 8 }}>
                    <ImageIcon color={t.accent.blue} size={iconSize} />
                    <strong style={{ color: t.text.primary }}>Frames</strong>
                    <span style={{ color: t.text.faint, fontSize: `${12 * uiScale}px`, marginLeft: 'auto' }}>
                        {filteredFrameNames.length}/{frameNames.length}
                    </span>
                    <button
                        aria-label={density === 'compact' ? 'Use comfortable frame rows' : 'Use compact frame rows'}
                        onClick={() => setDensity((current) => current === 'compact' ? 'comfortable' : 'compact')}
                        onMouseDown={(event) => applySpritesheetButtonPressed(event, false, density === 'compact')}
                        onMouseEnter={(event) => applySpritesheetButtonHover(event, false, density === 'compact')}
                        onMouseLeave={(event) => resetSpritesheetButtonBackground(event, false, density === 'compact')}
                        onMouseUp={(event) => applySpritesheetButtonHover(event, false, density === 'compact')}
                        style={{
                            ...spritesheetButtonStyle({ active: density === 'compact' }),
                            minHeight: Math.max(26, Math.round(26 * uiScale)),
                            padding: `${3 * uiScale}px ${7 * uiScale}px`,
                        }}
                        title={density === 'compact' ? 'Comfortable rows' : 'Compact rows'}
                        type="button"
                    >
                        <Rows3 size={iconSize} />
                    </button>
                </div>
                <label style={{ alignItems: 'center', background: t.bg.input, border: `1px solid ${t.border.input}`, borderRadius: t.radius.sm, display: 'grid', gap: 6, gridTemplateColumns: 'auto minmax(0, 1fr)', padding: `${5 * uiScale}px ${7 * uiScale}px` }}>
                    <Search color={t.text.faint} size={iconSize} />
                    <input
                        onChange={(event) => setFilter(event.target.value)}
                        placeholder="Filter frames"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: t.text.primary,
                            minWidth: 0,
                            outline: 'none',
                        }}
                        value={filter}
                    />
                </label>
            </div>

            <div className="zerith-scrollbar" style={{ minHeight: 0, overflow: 'auto' }}>
                {frameNames.length === 0 ? <div style={{ color: t.text.muted }}>No frames in descriptor.</div> : undefined}
                {frameNames.length > 0 && filteredFrameNames.length === 0 ? <div style={{ color: t.text.muted }}>No matching frames.</div> : undefined}
                <div style={{ display: 'grid', gap: metrics.rowGap }}>
                    {filteredFrameNames.map((name) => {
                        const frame = frames[name];
                        const isSelected = name === selectedFrame;
                        return (
                            <button
                                draggable
                                key={name}
                                onClick={() => onSelectFrame(name)}
                                onDragStart={(event) => {
                                    event.dataTransfer.effectAllowed = 'copyMove';
                                    event.dataTransfer.setData(FRAME_MIME, name);
                                    event.dataTransfer.setData('text/plain', name);
                                }}
                                onMouseDown={(event) => applySpritesheetButtonPressed(event, false, isSelected)}
                                onMouseEnter={(event) => applySpritesheetButtonHover(event, false, isSelected)}
                                onMouseLeave={(event) => resetSpritesheetButtonBackground(event, false, isSelected)}
                                onMouseUp={(event) => applySpritesheetButtonHover(event, false, isSelected)}
                                style={{
                                    alignItems: 'center',
                                    display: 'grid',
                                    gap: metrics.itemGap,
                                    gridTemplateColumns: `${metrics.thumbnailColumnWidth}px minmax(0, 1fr)`,
                                    minHeight: metrics.rowMinHeight,
                                    padding: metrics.rowPadding,
                                    textAlign: 'left',
                                    ...spritesheetButtonStyle({ active: isSelected }),
                                }}
                                type="button"
                            >
                                <FrameThumbnail
                                    boxSize={metrics.thumbnailBoxSize}
                                    frame={frame}
                                    image={image}
                                    maxSize={metrics.thumbnailCanvasMaxSize}
                                />
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                                    <div style={{ color: t.text.muted, fontSize: metrics.detailFontSize }}>
                                        {frame.w}x{frame.h} @ {frame.x},{frame.y}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {(onAddFrame || onRemoveFrame) ? (
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        disabled={!onAddFrame}
                        onClick={() => onAddFrame?.()}
                        onMouseDown={(event) => applySpritesheetButtonPressed(event, !onAddFrame, false)}
                        onMouseEnter={(event) => applySpritesheetButtonHover(event, !onAddFrame, false)}
                        onMouseLeave={(event) => resetSpritesheetButtonBackground(event, !onAddFrame, false)}
                        onMouseUp={(event) => applySpritesheetButtonHover(event, !onAddFrame, false)}
                        style={{
                            flex: 1,
                            ...spritesheetButtonStyle({ disabled: !onAddFrame }),
                        }}
                        title="Add frame"
                        type="button"
                    >
                        <Plus size={iconSize} />
                        Add
                    </button>
                    <button
                        disabled={!onRemoveFrame || !selectedFrame}
                        onClick={() => {
                            if (!selectedFrame || !onRemoveFrame) return;
                            setPendingFrameRemoval(selectedFrame);
                        }}
                        onMouseDown={(event) => applySpritesheetButtonPressed(event, !onRemoveFrame || !selectedFrame, false)}
                        onMouseEnter={(event) => applySpritesheetButtonHover(event, !onRemoveFrame || !selectedFrame, false)}
                        onMouseLeave={(event) => resetSpritesheetButtonBackground(event, !onRemoveFrame || !selectedFrame, false)}
                        onMouseUp={(event) => applySpritesheetButtonHover(event, !onRemoveFrame || !selectedFrame, false)}
                        style={{
                            flex: 1,
                            ...spritesheetButtonStyle({ disabled: !onRemoveFrame || !selectedFrame }),
                        }}
                        title="Remove selected frame"
                        type="button"
                    >
                        <Trash2 size={iconSize} />
                        Remove
                    </button>
                </div>
            ) : undefined}

            <ConfirmDialog
                danger
                message={pendingFrameRemoval ? `Remove frame "${pendingFrameRemoval}"?` : ''}
                onCancel={() => setPendingFrameRemoval(undefined)}
                onConfirm={confirmRemoveFrame}
                open={Boolean(pendingFrameRemoval)}
                title="Remove Frame"
            />
        </div>
    );
}

function FrameThumbnail({ boxSize, frame, image, maxSize }: FrameThumbnailProperties) {
    const canvasReference = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasReference.current;
        if (!canvas) return;
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
            // Keep thumbnail blank when frame bounds are invalid for the current source image.
        }
    }, [frame, image, maxSize]);

    return (
        <div
            style={{
                alignItems: 'center',
                background: t.bg.panelAlt,
                border: `1px solid ${t.border.subtle}`,
                borderRadius: t.radius.sm,
                display: 'flex',
                height: boxSize,
                justifyContent: 'center',
                overflow: 'hidden',
                width: boxSize,
            }}
        >
            <canvas ref={canvasReference} />
        </div>
    );
}


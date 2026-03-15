import { type SpriteFrame } from 'core';
import { useEffect, useMemo, useRef } from 'react';

import { editorTheme as t } from '../../theme/editorTheme';
import { computeThumbnailCanvasMetrics } from './spritesheetEditorModel';

const FRAME_MIME = 'application/x-zerith-frame';

export type SpritesheetFrameListProps = {
    frames: Record<string, SpriteFrame>;
    image: HTMLImageElement;
    onAddFrame?: () => void;
    onRemoveFrame?: (name: string) => void;
    onSelectFrame: (name: string) => void;
    selectedFrame?: string;
    uiScale: number;
};

type FrameThumbnailProperties = {
    frame: SpriteFrame;
    image: HTMLImageElement;
    uiScale: number;
};

export function SpritesheetFrameList({
    frames,
    image,
    onAddFrame,
    onRemoveFrame,
    onSelectFrame,
    selectedFrame,
    uiScale,
}: SpritesheetFrameListProps) {
    const frameNames = useMemo(() => Object.keys(frames), [frames]);

    return (
        <div style={{ display: 'grid', gap: 10, gridTemplateRows: 'minmax(0, 1fr) auto', height: '100%' }}>
            <div className="zerith-scrollbar" style={{ minHeight: 0, overflow: 'auto' }}>
                {frameNames.length === 0 ? <div style={{ color: t.text.muted }}>No frames in descriptor.</div> : null}
                <div style={{ display: 'grid', gap: 6 }}>
                    {frameNames.map((name) => {
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
                                style={{
                                    alignItems: 'center',
                                    background: isSelected ? t.bg.selected : t.bg.panel,
                                    border: `1px solid ${isSelected ? t.accent.primary : t.border.input}`,
                                    borderRadius: t.radius.sm,
                                    color: t.text.normal,
                                    cursor: 'pointer',
                                    display: 'grid',
                                    gap: 8,
                                    gridTemplateColumns: '56px minmax(0, 1fr)',
                                    padding: 6,
                                    textAlign: 'left',
                                }}
                            >
                                <FrameThumbnail frame={frame} image={image} uiScale={uiScale} />
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                                    <div style={{ color: t.text.muted, fontSize: 12 }}>{frame.w}x{frame.h}</div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {(onAddFrame || onRemoveFrame) ? (
                <div style={{ display: 'flex', gap: 8 }}>
                    <button disabled={!onAddFrame} onClick={() => onAddFrame?.()} style={{ flex: 1 }}>Add Frame</button>
                    <button
                        disabled={!onRemoveFrame || !selectedFrame}
                        onClick={() => {
                            if (!selectedFrame || !onRemoveFrame) return;
                            if (!globalThis.confirm(`Remove frame \"${selectedFrame}\"?`)) return;
                            onRemoveFrame(selectedFrame);
                        }}
                        style={{ flex: 1 }}
                    >
                        Remove Frame
                    </button>
                </div>
            ) : null}
        </div>
    );
}

function FrameThumbnail({ frame, image, uiScale }: FrameThumbnailProperties) {
    const canvasReference = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasReference.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        if (!context) return;

        const dpr = window.devicePixelRatio || 1;
        const { height, pixelHeight, pixelWidth, width } = computeThumbnailCanvasMetrics(frame, Math.max(24, Math.round(48 * uiScale)), dpr);

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
    }, [frame, image, uiScale]);

    return (
        <div
            style={{
                alignItems: 'center',
                background: t.bg.panelAlt,
                border: `1px solid ${t.border.subtle}`,
                borderRadius: t.radius.sm,
                display: 'flex',
                height: 52,
                justifyContent: 'center',
                overflow: 'hidden',
                width: 52,
            }}
        >
            <canvas ref={canvasReference} />
        </div>
    );
}


import { type SpriteFrame } from 'core';
import { useEffect, useMemo, useRef, useState } from 'react';

import { editorTheme as t } from '../../theme/editorTheme';
import { ConfirmDialog } from '../ConfirmDialog';
import {
    applySpritesheetButtonHover,
    applySpritesheetButtonPressed,
    resetSpritesheetButtonBackground,
    spritesheetButtonStyle,
} from './spritesheetButtonStyles';
import { computeThumbnailCanvasMetrics } from './spritesheetEditorModel';

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
}: SpritesheetFrameListProperties) {
    const frameNames = useMemo(() => Object.keys(frames), [frames]);
    const [pendingFrameRemoval, setPendingFrameRemoval] = useState<string>();

    const confirmRemoveFrame = () => {
        if (!pendingFrameRemoval || !onRemoveFrame) return;
        onRemoveFrame(pendingFrameRemoval);
        setPendingFrameRemoval(undefined);
    };

    return (
        <div style={{ display: 'grid', gap: 10, gridTemplateRows: 'minmax(0, 1fr) auto', height: '100%' }}>
            <div className="zerith-scrollbar" style={{ minHeight: 0, overflow: 'auto' }}>
                {frameNames.length === 0 ? <div style={{ color: t.text.muted }}>No frames in descriptor.</div> : undefined}
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
                                onMouseDown={(event) => applySpritesheetButtonPressed(event, false, isSelected)}
                                onMouseEnter={(event) => applySpritesheetButtonHover(event, false, isSelected)}
                                onMouseLeave={(event) => resetSpritesheetButtonBackground(event, false, isSelected)}
                                onMouseUp={(event) => applySpritesheetButtonHover(event, false, isSelected)}
                                style={{
                                    alignItems: 'center',
                                    display: 'grid',
                                    gap: 8,
                                    gridTemplateColumns: '56px minmax(0, 1fr)',
                                    padding: 6,
                                    textAlign: 'left',
                                    ...spritesheetButtonStyle({ active: isSelected }),
                                }}
                                type="button"
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
                        type="button"
                    >
                        Add Frame
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
                        type="button"
                    >
                        Remove Frame
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


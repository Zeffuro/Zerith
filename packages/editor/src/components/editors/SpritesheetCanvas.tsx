import { applyChromaKey, type SpriteFrame } from 'core';
import { type MouseEvent, useEffect, useMemo, useRef, useState } from 'react';

import { editorTheme as t } from '../../theme/editorTheme';
import { frameAtPoint } from './spritesheetEditorModel';

const MAX_ZOOM = 8;
const MIN_ZOOM = 0.1;

type Point = { x: number; y: number };

type SpritesheetCanvasProperties = {
    chromaKey?: string;
    chromaTolerance?: number;
    frames: Record<string, SpriteFrame>;
    image: HTMLImageElement;
    onSelectFrame: (name: string) => void;
    panOffset: Point;
    selectedFrame?: string;
    setPanOffset: (offset: Point) => void;
    setZoom: (zoom: number) => void;
    showGrid: boolean;
    uiScale: number;
    zoom: number;
};
export function SpritesheetCanvas({
    chromaKey,
    chromaTolerance,
    frames,
    image,
    onSelectFrame,
    panOffset,
    selectedFrame,
    setPanOffset,
    setZoom,
    showGrid,
    uiScale,
    zoom,
}: SpritesheetCanvasProperties) {
    const containerReference = useRef<HTMLDivElement>(null);
    const canvasReference = useRef<HTMLCanvasElement>(null);
    const [hoveredFrame, setHoveredFrame] = useState<string>();
    const [isSpacePressed, setIsSpacePressed] = useState(false);
    const dragStateReference = useRef<{ moved: boolean; originMouse: Point; originPan: Point; panning: boolean }>({
        moved: false,
        originMouse: { x: 0, y: 0 },
        originPan: { x: 0, y: 0 },
        panning: false,
    });
    const previewSource = useMemo(() => {
        if (!chromaKey) return image;
        return applyChromaKey(image, chromaKey, chromaTolerance ?? 30);
    }, [chromaKey, chromaTolerance, image]);
    const frameEntries = useMemo(() => Object.entries(frames), [frames]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.code === 'Space') {
                setIsSpacePressed(true);
            }
        };
        const handleKeyUp = (event: KeyboardEvent) => {
            if (event.code === 'Space') {
                setIsSpacePressed(false);
            }
        };
        globalThis.addEventListener('keydown', handleKeyDown);
        globalThis.addEventListener('keyup', handleKeyUp);
        return () => {
            globalThis.removeEventListener('keydown', handleKeyDown);
            globalThis.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    useEffect(() => {
        const canvas = canvasReference.current;
        const container = containerReference.current;
        if (!canvas || !container) return;
        const context = canvas.getContext('2d');
        if (!context) return;

        const draw = () => {
            const width = container.clientWidth;
            const height = container.clientHeight;
            const dpr = window.devicePixelRatio || 1;
            canvas.width = Math.max(1, Math.floor(width * dpr));
            canvas.height = Math.max(1, Math.floor(height * dpr));
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            context.setTransform(1, 0, 0, 1, 0, 0);
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.scale(dpr, dpr);
            context.imageSmoothingEnabled = false;
            context.save();
            context.translate(panOffset.x, panOffset.y);
            context.scale(zoom, zoom);
            context.drawImage(previewSource, 0, 0);

            if (showGrid) {
                drawGrid(context, image.naturalWidth, image.naturalHeight, frameEntries);
            }

            for (const [name, frame] of frameEntries) {
                const isSelected = selectedFrame === name;
                const isHovered = hoveredFrame === name;
                drawFrameOverlay(context, name, frame, { isHovered, isSelected, uiScale, zoom });
            }
            context.restore();
        };
        draw();
        const resizeObserver = new ResizeObserver(draw);
        resizeObserver.observe(container);
        return () => {
            resizeObserver.disconnect();
        };
    }, [frameEntries, hoveredFrame, image.naturalHeight, image.naturalWidth, panOffset, previewSource, selectedFrame, showGrid, uiScale, zoom]);

    const findFrameAtPoint = (point: Point): string | undefined => {
        const imageX = (point.x - panOffset.x) / zoom;
        const imageY = (point.y - panOffset.y) / zoom;
        return frameAtPoint(frameEntries, imageX, imageY);
    };

    const toLocalPoint = (event: MouseEvent<HTMLCanvasElement>): Point => {
        const bounds = event.currentTarget.getBoundingClientRect();
        return {
            x: event.clientX - bounds.left,
            y: event.clientY - bounds.top,
        };
    };

    return (
        <div
            onKeyDown={(event) => {
                if (event.ctrlKey && event.key === '0') {
                    event.preventDefault();
                    setZoom(1);
                    setPanOffset({ x: 0, y: 0 });
                }
            }}
            ref={containerReference}
            style={{
                background: t.bg.panel,
                border: `1px solid ${t.border.subtle}`,
                borderRadius: t.radius.md,
                minHeight: 0,
                overflow: 'hidden',
                position: 'relative',
            }}
            tabIndex={0}
        >
            <canvas
                onClick={(event) => {
                    if (dragStateReference.current.moved) {
                        dragStateReference.current.moved = false;
                        return;
                    }
                    const frameName = findFrameAtPoint(toLocalPoint(event));
                    if (frameName) {
                        onSelectFrame(frameName);
                    }
                }}
                onContextMenu={(event) => event.preventDefault()}
                onMouseDown={(event) => {
                    const panWithMiddleMouse = event.button === 1;
                    const panWithSpaceDrag = event.button === 0 && isSpacePressed;
                    if (!panWithMiddleMouse && !panWithSpaceDrag) return;
                    event.preventDefault();
                    dragStateReference.current = {
                        moved: false,
                        originMouse: { x: event.clientX, y: event.clientY },
                        originPan: panOffset,
                        panning: true,
                    };
                }}
                onMouseLeave={() => {
                    setHoveredFrame(undefined);
                    dragStateReference.current.panning = false;
                }}
                onMouseMove={(event) => {
                    if (dragStateReference.current.panning) {
                        const deltaX = event.clientX - dragStateReference.current.originMouse.x;
                        const deltaY = event.clientY - dragStateReference.current.originMouse.y;
                        if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
                            dragStateReference.current.moved = true;
                        }

                        setPanOffset({
                            x: dragStateReference.current.originPan.x + deltaX,
                            y: dragStateReference.current.originPan.y + deltaY,
                        });
                        return;
                    }

                    setHoveredFrame(findFrameAtPoint(toLocalPoint(event)));
                }}
                onMouseUp={() => {
                    dragStateReference.current.panning = false;
                }}
                onWheel={(event) => {
                    event.preventDefault();
                    const bounds = event.currentTarget.getBoundingClientRect();
                    const cursorX = event.clientX - bounds.left;
                    const cursorY = event.clientY - bounds.top;
                    const imageX = (cursorX - panOffset.x) / zoom;
                    const imageY = (cursorY - panOffset.y) / zoom;
                    const nextZoom = clampZoom(zoom * (event.deltaY > 0 ? 0.9 : 1.1));
                    setZoom(nextZoom);
                    setPanOffset({
                        x: cursorX - imageX * nextZoom,
                        y: cursorY - imageY * nextZoom,
                    });
                }}
                ref={canvasReference}
                style={{
                    cursor: dragStateReference.current.panning ? 'grabbing' : (isSpacePressed ? 'grab' : 'crosshair'),
                    display: 'block',
                    height: '100%',
                    width: '100%',
                }}
            />
        </div>
    );
}

function clampZoom(value: number): number {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}
function drawFrameOverlay(
    context: CanvasRenderingContext2D,
    name: string,
    frame: SpriteFrame,
    options: { isHovered: boolean; isSelected: boolean; uiScale: number; zoom: number },
) {
    const lineWidth = 1 / options.zoom;
    const fillColor = options.isSelected ? 'rgba(79, 70, 229, 0.25)' : (options.isHovered ? 'rgba(59, 130, 246, 0.18)' : 'rgba(255, 255, 255, 0.06)');
    const strokeColor = options.isSelected ? t.accent.primary : (options.isHovered ? t.accent.blue : 'rgba(255, 255, 255, 0.35)');

    context.fillStyle = fillColor;
    context.strokeStyle = strokeColor;
    context.lineWidth = lineWidth;
    context.fillRect(frame.x, frame.y, frame.w, frame.h);
    context.strokeRect(frame.x, frame.y, frame.w, frame.h);

    const fontSize = Math.max(10 / options.zoom, 9 * (options.uiScale / options.zoom));
    context.font = `${fontSize}px sans-serif`;
    context.textBaseline = 'top';

    const textWidth = context.measureText(name).width;
    const labelX = frame.x + 2 / options.zoom;
    const labelY = frame.y + 2 / options.zoom;
    const labelHeight = fontSize + 4 / options.zoom;
    const labelWidth = textWidth + 6 / options.zoom;
    context.fillStyle = 'rgba(15, 23, 42, 0.75)';
    context.fillRect(labelX, labelY, Math.min(labelWidth, frame.w), Math.min(labelHeight, frame.h));
    context.fillStyle = '#f8fafc';
    context.fillText(name, labelX + 3 / options.zoom, labelY + 2 / options.zoom, Math.max(0, frame.w - 6 / options.zoom));
}

function drawGrid(context: CanvasRenderingContext2D, imageWidth: number, imageHeight: number, entries: Array<[string, SpriteFrame]>) {
    if (entries.length === 0) return;

    const frame = entries[0][1];
    if (frame.w <= 0 || frame.h <= 0) return;

    context.save();
    context.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    context.lineWidth = 1;

    for (let x = 0; x <= imageWidth; x += frame.w) {
        context.beginPath();
        context.moveTo(x + 0.5, 0);
        context.lineTo(x + 0.5, imageHeight);
        context.stroke();
    }

    for (let y = 0; y <= imageHeight; y += frame.h) {
        context.beginPath();
        context.moveTo(0, y + 0.5);
        context.lineTo(imageWidth, y + 0.5);
        context.stroke();
    }

    context.restore();
}


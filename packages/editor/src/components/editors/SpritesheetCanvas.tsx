import { applyChromaKey, type SpriteFrame } from 'core';
import { type MouseEvent, useEffect, useMemo, useRef, useState } from 'react';

import { editorTheme as t } from '../../theme/editorTheme';
import {
    clampZoom,
    findFrameAtPoint,
    findSliceHandleAtPoint,
    type Point,
    type SliceHandle,
    toImagePoint,
    toLocalPoint,
} from './spritesheetCanvasInteraction';
import {
    type ManualFrameRect,
    type ManualSliceAxis,
    type ManualSliceLines,
    normalizeManualDragFrame,
} from './spritesheetEditorModel';

type ManualTool = 'draw' | 'select' | 'slice';

type SpritesheetCanvasProperties = {
    chromaKey?: string;
    chromaTolerance?: number;
    frames: Record<string, SpriteFrame>;
    image: HTMLImageElement;
    manualRectPreview?: ManualFrameRect;
    manualTool: ManualTool;
    onSelectFrame: (name: string) => void;
    onSetManualRectPreview: (rect?: ManualFrameRect) => void;
    onSliceLineAdd: (axis: ManualSliceAxis, value: number) => void;
    onSliceLineMove: (axis: ManualSliceAxis, index: number, value: number) => void;
    panOffset: Point;
    selectedFrame?: string;
    setPanOffset: (offset: Point) => void;
    setZoom: (zoom: number) => void;
    showGrid: boolean;
    sliceAxis: ManualSliceAxis;
    sliceLines: ManualSliceLines;
    slicePreviewFrames: ManualFrameRect[];
    uiScale: number;
    zoom: number;
};
export function SpritesheetCanvas({
    chromaKey,
    chromaTolerance,
    frames,
    image,
    manualRectPreview,
    manualTool,
    onSelectFrame,
    onSetManualRectPreview,
    onSliceLineAdd,
    onSliceLineMove,
    panOffset,
    selectedFrame,
    setPanOffset,
    setZoom,
    showGrid,
    sliceAxis,
    sliceLines,
    slicePreviewFrames,
    uiScale,
    zoom,
}: SpritesheetCanvasProperties) {
    const containerReference = useRef<HTMLDivElement>(null);
    const canvasReference = useRef<HTMLCanvasElement>(null);
    const [hoveredFrame, setHoveredFrame] = useState<string>();
    const [activeSliceHandle, setActiveSliceHandle] = useState<SliceHandle>();
    const [hoveredSliceHandle, setHoveredSliceHandle] = useState<SliceHandle>();
    const [isSpacePressed, setIsSpacePressed] = useState(false);
    const [isPanning, setIsPanning] = useState(false);
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
    const sliceDragReference = useRef<{ active: boolean; handle: SliceHandle; moved: boolean }>({
        active: false,
        handle: { axis: 'vertical', index: 0 },
        moved: false,
    });
    const drawDragReference = useRef<{ active: boolean; current: Point; start: Point }>({
        active: false,
        current: { x: 0, y: 0 },
        start: { x: 0, y: 0 },
    });
    const suppressClickReference = useRef(false);

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

            drawManualSliceOverlay(context, {
                imageHeight: image.naturalHeight,
                imageWidth: image.naturalWidth,
                lines: sliceLines,
                previewFrames: slicePreviewFrames,
                selectedHandle: activeSliceHandle,
                zoom,
            });

            if (manualRectPreview) {
                drawManualRectOverlay(context, manualRectPreview, zoom);
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
    }, [
        activeSliceHandle,
        frameEntries,
        hoveredFrame,
        image.naturalHeight,
        image.naturalWidth,
        manualRectPreview,
        panOffset,
        previewSource,
        selectedFrame,
        showGrid,
        sliceLines,
        slicePreviewFrames,
        uiScale,
        zoom,
    ]);

    const toCanvasLocalPoint = (event: MouseEvent<HTMLCanvasElement>): Point => {
        const bounds = event.currentTarget.getBoundingClientRect();
        return toLocalPoint({ x: event.clientX, y: event.clientY }, bounds);
    };

    const findSliceHandleForCurrentMode = (point: Point): SliceHandle | undefined => {
        if (manualTool !== 'slice') return undefined;
        return findSliceHandleAtPoint(point, { lines: sliceLines, panOffset, zoom });
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
                    if (dragStateReference.current.moved || suppressClickReference.current) {
                        dragStateReference.current.moved = false;
                        suppressClickReference.current = false;
                        return;
                    }

                    if (manualTool === 'slice') {
                        const imagePoint = toImagePoint(toCanvasLocalPoint(event), panOffset, zoom);
                        const axisValue = sliceAxis === 'vertical' ? imagePoint.x : imagePoint.y;
                        onSliceLineAdd(sliceAxis, axisValue);
                        return;
                    }

                    if (manualTool !== 'select') return;

                    const frameName = findFrameAtPoint(frameEntries, toCanvasLocalPoint(event), panOffset, zoom);
                    if (frameName) {
                        onSelectFrame(frameName);
                    }
                }}
                onContextMenu={(event) => event.preventDefault()}
                onMouseDown={(event) => {
                    const panWithMiddleMouse = event.button === 1;
                    const panWithSpaceDrag = event.button === 0 && isSpacePressed;
                    if (panWithMiddleMouse || panWithSpaceDrag) {
                        event.preventDefault();
                        dragStateReference.current = {
                            moved: false,
                            originMouse: { x: event.clientX, y: event.clientY },
                            originPan: panOffset,
                            panning: true,
                        };
                        setIsPanning(true);
                        return;
                    }

                    if (event.button !== 0) return;
                    const localPoint = toCanvasLocalPoint(event);

                    if (manualTool === 'slice') {
                        const handle = findSliceHandleForCurrentMode(localPoint);
                        if (handle) {
                            event.preventDefault();
                            sliceDragReference.current.active = true;
                            sliceDragReference.current.handle = handle;
                            sliceDragReference.current.moved = false;
                            setActiveSliceHandle(handle);
                        }
                        return;
                    }

                    if (manualTool === 'draw') {
                        const imagePoint = toImagePoint(localPoint, panOffset, zoom);
                        drawDragReference.current.active = true;
                        drawDragReference.current.current = imagePoint;
                        drawDragReference.current.start = imagePoint;
                        onSetManualRectPreview();
                    }
                }}
                onMouseLeave={() => {
                    setHoveredFrame(undefined);
                    setHoveredSliceHandle(undefined);
                    dragStateReference.current.panning = false;
                    sliceDragReference.current.active = false;
                    setActiveSliceHandle(undefined);
                    setIsPanning(false);
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

                    if (sliceDragReference.current.active) {
                        const localPoint = toCanvasLocalPoint(event);
                        const imagePoint = toImagePoint(localPoint, panOffset, zoom);
                        const { axis, index } = sliceDragReference.current.handle;
                        onSliceLineMove(axis, index, axis === 'vertical' ? imagePoint.x : imagePoint.y);
                        sliceDragReference.current.moved = true;
                        suppressClickReference.current = true;
                        return;
                    }

                    if (drawDragReference.current.active) {
                        const localPoint = toCanvasLocalPoint(event);
                        const imagePoint = toImagePoint(localPoint, panOffset, zoom);
                        drawDragReference.current.current = imagePoint;
                        const rect = normalizeManualDragFrame(drawDragReference.current.start, imagePoint, {
                            height: image.naturalHeight,
                            width: image.naturalWidth,
                        });
                        onSetManualRectPreview(rect);
                        suppressClickReference.current = true;
                        return;
                    }

                    setHoveredSliceHandle(findSliceHandleForCurrentMode(toCanvasLocalPoint(event)));
                    if (manualTool !== 'select') {
                        setHoveredFrame(undefined);
                        return;
                    }

                    setHoveredFrame(findFrameAtPoint(frameEntries, toCanvasLocalPoint(event), panOffset, zoom));
                }}
                onMouseUp={() => {
                    dragStateReference.current.panning = false;
                    setIsPanning(false);

                    if (sliceDragReference.current.active && sliceDragReference.current.moved) {
                        suppressClickReference.current = true;
                    }
                    sliceDragReference.current.active = false;
                    setActiveSliceHandle(undefined);

                    if (drawDragReference.current.active) {
                        const rect = normalizeManualDragFrame(drawDragReference.current.start, drawDragReference.current.current, {
                            height: image.naturalHeight,
                            width: image.naturalWidth,
                        });
                        onSetManualRectPreview(rect);
                        drawDragReference.current.active = false;
                    }
                }}
                onWheel={(event) => {
                    event.preventDefault();
                    const bounds = event.currentTarget.getBoundingClientRect();
                    const cursorX = event.clientX - bounds.left;
                    const cursorY = event.clientY - bounds.top;
                    const imagePoint = toImagePoint({ x: cursorX, y: cursorY }, panOffset, zoom);
                    const nextZoom = clampZoom(zoom * (event.deltaY > 0 ? 0.9 : 1.1));
                    setZoom(nextZoom);
                    setPanOffset({
                        x: cursorX - imagePoint.x * nextZoom,
                        y: cursorY - imagePoint.y * nextZoom,
                    });
                }}
                ref={canvasReference}
                style={{
                    cursor: isPanning
                        ? 'grabbing'
                        : (isSpacePressed
                            ? 'grab'
                            : getCursorForMode(manualTool, hoveredSliceHandle, activeSliceHandle)),
                    display: 'block',
                    height: '100%',
                    width: '100%',
                }}
            />
        </div>
    );
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

function drawManualRectOverlay(context: CanvasRenderingContext2D, rect: ManualFrameRect, zoom: number) {
    context.save();
    context.lineWidth = Math.max(1 / zoom, 0.75 / zoom);
    context.strokeStyle = 'rgba(245, 158, 11, 0.95)';
    context.fillStyle = 'rgba(245, 158, 11, 0.22)';
    context.fillRect(rect.x, rect.y, rect.w, rect.h);
    context.strokeRect(rect.x, rect.y, rect.w, rect.h);
    context.restore();
}

function drawManualSliceOverlay(
    context: CanvasRenderingContext2D,
    options: {
        imageHeight: number;
        imageWidth: number;
        lines: ManualSliceLines;
        previewFrames: ManualFrameRect[];
        selectedHandle?: SliceHandle;
        zoom: number;
    },
) {
    const lineWidth = 1 / options.zoom;

    context.save();
    context.lineWidth = lineWidth;

    for (const frame of options.previewFrames) {
        context.fillStyle = 'rgba(245, 158, 11, 0.12)';
        context.strokeStyle = 'rgba(245, 158, 11, 0.18)';
        context.fillRect(frame.x, frame.y, frame.w, frame.h);
        context.strokeRect(frame.x, frame.y, frame.w, frame.h);
    }

    for (let index = 0; index < options.lines.vertical.length; index += 1) {
        const x = options.lines.vertical[index];
        context.strokeStyle = options.selectedHandle?.axis === 'vertical' && options.selectedHandle.index === index
            ? 'rgba(249, 115, 22, 0.95)'
            : 'rgba(251, 191, 36, 0.95)';
        context.beginPath();
        context.moveTo(x + lineWidth * 0.5, 0);
        context.lineTo(x + lineWidth * 0.5, options.imageHeight);
        context.stroke();
    }

    for (let index = 0; index < options.lines.horizontal.length; index += 1) {
        const y = options.lines.horizontal[index];
        context.strokeStyle = options.selectedHandle?.axis === 'horizontal' && options.selectedHandle.index === index
            ? 'rgba(249, 115, 22, 0.95)'
            : 'rgba(251, 191, 36, 0.95)';
        context.beginPath();
        context.moveTo(0, y + lineWidth * 0.5);
        context.lineTo(options.imageWidth, y + lineWidth * 0.5);
        context.stroke();
    }

    context.restore();
}

function getCursorForMode(manualTool: ManualTool, hoveredSliceHandle?: SliceHandle, draggingSliceHandle?: SliceHandle): string {
    if (manualTool === 'draw') {
        return 'crosshair';
    }
    const activeHandle = draggingSliceHandle ?? hoveredSliceHandle;
    if (manualTool === 'slice' && activeHandle) {
        return activeHandle.axis === 'vertical' ? 'ew-resize' : 'ns-resize';
    }
    return manualTool === 'slice' ? 'copy' : 'crosshair';
}


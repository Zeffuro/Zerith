import { applyChromaKey, type SpriteFrame } from 'core';
import { type MouseEvent, useEffect, useMemo, useRef, useState } from 'react';

import { editorTheme as t } from '../../theme/editorTheme';
import {
    beginDrawDrag,
    beginPanDrag,
    beginSliceDrag,
    clampZoom,
    createDrawDragState,
    createPanDragState,
    createSliceDragState,
    findFrameAtPoint,
    findSliceHandleAtPoint,
    finishDrawDrag,
    getCursorForMode,
    type Point,
    type SliceHandle,
    toImagePoint,
    toLocalPoint,
    updateDrawDrag,
    updatePanDrag,
    updateSliceDrag,
} from './spritesheetCanvasInteraction';
import { drawFrameOverlays, drawGrid, drawImageBackdrop, drawSelection, drawSliceLines } from './spritesheetCanvasRenderer';
import { type ManualFrameRect, type ManualSliceAxis, type ManualSliceLines, type ManualTool } from './spritesheetEditorModel';

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
    const dragStateReference = useRef(createPanDragState());
    const sliceDragReference = useRef(createSliceDragState());
    const drawDragReference = useRef(createDrawDragState());
    const pointerOverCanvasReference = useRef(false);
    const suppressClickReference = useRef(false);
    const previewSource = useMemo(() => {
        if (!chromaKey) return image;
        try {
            return applyChromaKey(image, chromaKey, chromaTolerance ?? 30);
        } catch (error) {
            // Cross-origin images can taint the canvas and block pixel reads; keep rendering without chroma key.
            if (error instanceof DOMException && error.name === 'SecurityError') {
                return image;
            }
            throw error;
        }
    }, [chromaKey, chromaTolerance, image]);
    const frameEntries = useMemo(() => Object.entries(frames), [frames]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.code === 'Space') {
                const activeElement = document.activeElement;
                const canvasIsActive = activeElement instanceof Node && Boolean(containerReference.current?.contains(activeElement));
                if ((pointerOverCanvasReference.current || canvasIsActive) && !isEditableKeyboardTarget(event.target)) {
                    event.preventDefault();
                }
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
            drawImageBackdrop(context, image.naturalWidth, image.naturalHeight, zoom);
            context.drawImage(previewSource, 0, 0);

            if (showGrid) {
                drawGrid(context, image.naturalWidth, image.naturalHeight, frameEntries);
            }

            drawSliceLines(context, {
                imageHeight: image.naturalHeight,
                imageWidth: image.naturalWidth,
                lines: sliceLines,
                previewFrames: slicePreviewFrames,
                selectedHandle: activeSliceHandle,
                zoom,
            });

            if (manualRectPreview) {
                drawSelection(context, manualRectPreview, zoom);
            }

            drawFrameOverlays(context, frameEntries, {
                hoveredFrame,
                selectedFrame,
                uiScale,
                zoom,
            });
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

    useEffect(() => {
        const canvas = canvasReference.current;
        if (!canvas) return;

        const handleWheel = (event: WheelEvent) => {
            const bounds = canvas.getBoundingClientRect();
            if (bounds.width <= 0 || bounds.height <= 0) return;

            if (event.cancelable) {
                event.preventDefault();
            }

            const cursorX = Math.min(Math.max(event.clientX - bounds.left, 0), Math.max(bounds.width, 1));
            const cursorY = Math.min(Math.max(event.clientY - bounds.top, 0), Math.max(bounds.height, 1));
            const imagePoint = toImagePoint({ x: cursorX, y: cursorY }, panOffset, zoom);
            const nextZoom = clampZoom(zoom * (event.deltaY > 0 ? 0.9 : 1.1));
            setZoom(nextZoom);
            setPanOffset({
                x: cursorX - imagePoint.x * nextZoom,
                y: cursorY - imagePoint.y * nextZoom,
            });
        };

        canvas.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            canvas.removeEventListener('wheel', handleWheel);
        };
    }, [panOffset, setPanOffset, setZoom, zoom]);

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
                        onSliceLineAdd(sliceAxis, sliceAxis === 'vertical' ? imagePoint.x : imagePoint.y);
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
                    containerReference.current?.focus();
                    const panWithMiddleMouse = event.button === 1;
                    const panWithRightMouse = event.button === 2;
                    const panWithSpaceDrag = event.button === 0 && isSpacePressed;
                    if (panWithMiddleMouse || panWithRightMouse || panWithSpaceDrag) {
                        event.preventDefault();
                        dragStateReference.current = beginPanDrag({ x: event.clientX, y: event.clientY }, panOffset);
                        setIsPanning(true);
                        return;
                    }
                    if (event.button !== 0) return;
                    const localPoint = toCanvasLocalPoint(event);
                    if (manualTool === 'slice') {
                        const handle = findSliceHandleForCurrentMode(localPoint);
                        if (handle) {
                            event.preventDefault();
                            sliceDragReference.current = beginSliceDrag(handle);
                            setActiveSliceHandle(handle);
                        }
                        return;
                    }
                    if (manualTool === 'draw') {
                        drawDragReference.current = beginDrawDrag(toImagePoint(localPoint, panOffset, zoom));
                        onSetManualRectPreview();
                    }
                }}
                onMouseEnter={() => {
                    pointerOverCanvasReference.current = true;
                }}
                onMouseLeave={() => {
                    pointerOverCanvasReference.current = false;
                    setHoveredFrame(undefined);
                    setHoveredSliceHandle(undefined);
                    dragStateReference.current.panning = false;
                    sliceDragReference.current = createSliceDragState();
                    setActiveSliceHandle(undefined);
                    setIsPanning(false);
                }}
                onMouseMove={(event) => {
                    if (dragStateReference.current.panning) {
                        const next = updatePanDrag(dragStateReference.current, { x: event.clientX, y: event.clientY });
                        dragStateReference.current.moved = next.moved;
                        setPanOffset(next.panOffset);
                        return;
                    }
                    if (sliceDragReference.current.active) {
                        const next = updateSliceDrag(sliceDragReference.current, toCanvasLocalPoint(event), { panOffset, zoom });
                        onSliceLineMove(next.axis, next.index, next.value);
                        sliceDragReference.current.moved = true;
                        suppressClickReference.current = true;
                        return;
                    }
                    if (drawDragReference.current.active) {
                        const imagePoint = toImagePoint(toCanvasLocalPoint(event), panOffset, zoom);
                        const next = updateDrawDrag(drawDragReference.current, imagePoint, {
                            height: image.naturalHeight,
                            width: image.naturalWidth,
                        });
                        drawDragReference.current = next.nextState;
                        onSetManualRectPreview(next.rect);
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
                    sliceDragReference.current = createSliceDragState();
                    setActiveSliceHandle(undefined);
                    if (drawDragReference.current.active) {
                        const next = finishDrawDrag(drawDragReference.current, {
                            height: image.naturalHeight,
                            width: image.naturalWidth,
                        });
                        onSetManualRectPreview(next.rect);
                        drawDragReference.current = next.nextState;
                    }
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

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    const tagName = target.tagName.toLowerCase();
    return ['input', 'select', 'textarea'].includes(tagName);
}

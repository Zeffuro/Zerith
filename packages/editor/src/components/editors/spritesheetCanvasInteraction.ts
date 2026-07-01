import { type SpriteFrame } from 'zerith-core';

import {
    frameAtPoint,
    type ManualFrameRect,
    type ManualSliceAxis,
    type ManualSliceLines,
    type ManualTool,
    normalizeManualDragFrame,
} from './spritesheetEditorModel';

const MAX_ZOOM = 8;
const MIN_ZOOM = 0.1;

export type DrawDragState = { active: boolean; current: Point; start: Point };

export type PanDragState = { moved: boolean; originMouse: Point; originPan: Point; panning: boolean };

export type Point = { x: number; y: number };

export type SliceDragState = { active: boolean; handle: SliceHandle; moved: boolean };

export type SliceHandle = { axis: ManualSliceAxis; index: number };

export function beginDrawDrag(imagePoint: Point): DrawDragState {
    return {
        active: true,
        current: imagePoint,
        start: imagePoint,
    };
}

export function beginPanDrag(originMouse: Point, originPan: Point): PanDragState {
    return {
        moved: false,
        originMouse,
        originPan,
        panning: true,
    };
}

export function beginSliceDrag(handle: SliceHandle): SliceDragState {
    return {
        active: true,
        handle,
        moved: false,
    };
}

export function clampZoom(value: number): number {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

export function createDrawDragState(): DrawDragState {
    return {
        active: false,
        current: { x: 0, y: 0 },
        start: { x: 0, y: 0 },
    };
}

export function createPanDragState(): PanDragState {
    return {
        moved: false,
        originMouse: { x: 0, y: 0 },
        originPan: { x: 0, y: 0 },
        panning: false,
    };
}

export function createSliceDragState(): SliceDragState {
    return {
        active: false,
        handle: { axis: 'vertical', index: 0 },
        moved: false,
    };
}

export function findFrameAtPoint(
    frameEntries: Array<[string, SpriteFrame]>,
    point: Point,
    panOffset: Point,
    zoom: number,
): string | undefined {
    const imagePoint = toImagePoint(point, panOffset, zoom);
    return frameAtPoint(frameEntries, imagePoint.x, imagePoint.y);
}

export function findSliceHandleAtPoint(
    point: Point,
    options: { lines: ManualSliceLines; panOffset: Point; zoom: number },
): SliceHandle | undefined {
    const imagePoint = toImagePoint(point, options.panOffset, options.zoom);
    const tolerance = Math.max(3, 8 / options.zoom);

    for (let index = 0; index < options.lines.vertical.length; index += 1) {
        if (Math.abs(options.lines.vertical[index] - imagePoint.x) <= tolerance) {
            return { axis: 'vertical', index };
        }
    }

    for (let index = 0; index < options.lines.horizontal.length; index += 1) {
        if (Math.abs(options.lines.horizontal[index] - imagePoint.y) <= tolerance) {
            return { axis: 'horizontal', index };
        }
    }

    return undefined;
}

export function finishDrawDrag(
    state: DrawDragState,
    bounds: { height: number; width: number },
): { nextState: DrawDragState; rect: ManualFrameRect | undefined } {
    return {
        nextState: createDrawDragState(),
        rect: normalizeManualDragFrame(state.start, state.current, bounds),
    };
}

export function getCursorForMode(manualTool: ManualTool, hoveredSliceHandle?: SliceHandle, draggingSliceHandle?: SliceHandle): string {
    if (manualTool === 'draw') {
        return 'crosshair';
    }
    const activeHandle = draggingSliceHandle ?? hoveredSliceHandle;
    if (manualTool === 'slice' && activeHandle) {
        return activeHandle.axis === 'vertical' ? 'ew-resize' : 'ns-resize';
    }
    return manualTool === 'slice' ? 'copy' : 'crosshair';
}

export function toImagePoint(point: Point, panOffset: Point, zoom: number): Point {
    return {
        x: (point.x - panOffset.x) / zoom,
        y: (point.y - panOffset.y) / zoom,
    };
}

export function toLocalPoint(clientPoint: Point, bounds: { left: number; top: number }): Point {
    return {
        x: clientPoint.x - bounds.left,
        y: clientPoint.y - bounds.top,
    };
}

export function updateDrawDrag(
    state: DrawDragState,
    imagePoint: Point,
    bounds: { height: number; width: number },
): { nextState: DrawDragState; rect: ManualFrameRect | undefined } {
    const nextState: DrawDragState = {
        ...state,
        current: imagePoint,
    };
    return {
        nextState,
        rect: normalizeManualDragFrame(nextState.start, nextState.current, bounds),
    };
}

export function updatePanDrag(state: PanDragState, cursor: Point): { moved: boolean; panOffset: Point } {
    const deltaX = cursor.x - state.originMouse.x;
    const deltaY = cursor.y - state.originMouse.y;
    const moved = state.moved || Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1;
    return {
        moved,
        panOffset: {
            x: state.originPan.x + deltaX,
            y: state.originPan.y + deltaY,
        },
    };
}

export function updateSliceDrag(
    state: SliceDragState,
    point: Point,
    options: { panOffset: Point; zoom: number },
): { axis: ManualSliceAxis; index: number; value: number } {
    const imagePoint = toImagePoint(point, options.panOffset, options.zoom);
    return {
        axis: state.handle.axis,
        index: state.handle.index,
        value: state.handle.axis === 'vertical' ? imagePoint.x : imagePoint.y,
    };
}

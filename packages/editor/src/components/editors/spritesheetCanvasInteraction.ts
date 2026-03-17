import { type SpriteFrame } from 'core';

import { frameAtPoint, type ManualSliceAxis, type ManualSliceLines } from './spritesheetEditorModel';

const MAX_ZOOM = 8;
const MIN_ZOOM = 0.1;

export type Point = { x: number; y: number };

export type SliceHandle = { axis: ManualSliceAxis; index: number };

export function clampZoom(value: number): number {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
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


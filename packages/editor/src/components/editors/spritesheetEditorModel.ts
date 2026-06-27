import { type SpriteFrame, type SpritesheetDescriptor } from 'core';

export type ManualFrameRect = Pick<SpriteFrame, 'h' | 'w' | 'x' | 'y'>;

export type ManualSliceAxis = 'horizontal' | 'vertical';

export type ManualSliceLines = {
    horizontal: number[];
    vertical: number[];
};

export type ManualTool = 'draw' | 'select' | 'slice';

export type SpritesheetFrameListDensity = 'comfortable' | 'compact';

export type SpritesheetFrameListMetrics = {
    detailFontSize: number;
    itemGap: number;
    rowGap: number;
    rowMinHeight: number;
    rowPadding: number;
    thumbnailBoxSize: number;
    thumbnailCanvasMaxSize: number;
    thumbnailColumnWidth: number;
};

export type ThumbnailCanvasMetrics = {
    height: number;
    pixelHeight: number;
    pixelWidth: number;
    width: number;
};

type ImageBounds = { height: number; width: number };

type Point = { x: number; y: number };

export function addSliceLine(lines: ManualSliceLines, axis: ManualSliceAxis, value: number, bounds: ImageBounds): ManualSliceLines {
    const key = axis === 'vertical' ? 'vertical' : 'horizontal';
    const nextValues = [...lines[key], clampInnerAxis(value, axis === 'vertical' ? bounds.width : bounds.height)];
    return {
        ...lines,
        [key]: sortUnique(nextValues),
    };
}

export function applyManualFrame(
    descriptor: SpritesheetDescriptor,
    existingFrames: Record<string, SpriteFrame>,
    rect: ManualFrameRect,
): { descriptor: SpritesheetDescriptor; frameName: string; } {
    const name = nextManualFrameName(existingFrames);
    const nextFrames = mergeFrameUpdates(existingFrames, {
        [name]: {
            ...rect,
            name,
        },
    });

    return {
        descriptor: {
            ...descriptor,
            format: 'atlas',
            frames: nextFrames,
        },
        frameName: name,
    };
}

export function applySliceLineFrames(
    descriptor: SpritesheetDescriptor,
    existingFrames: Record<string, SpriteFrame>,
    lines: ManualSliceLines,
    bounds: ImageBounds,
): { createdNames: string[]; descriptor: SpritesheetDescriptor } {
    const generated = buildFramesFromSliceLines(lines, bounds);
    if (generated.length === 0) {
        return { createdNames: [], descriptor };
    }

    const updates: Record<string, SpriteFrame> = {};
    const working = { ...existingFrames };
    const createdNames: string[] = [];
    for (const frame of generated) {
        const name = nextManualFrameName(working);
        const spriteFrame = { ...frame, name };
        updates[name] = spriteFrame;
        working[name] = spriteFrame;
        createdNames.push(name);
    }

    return {
        createdNames,
        descriptor: {
            ...descriptor,
            format: 'atlas',
            frames: {
                ...existingFrames,
                ...updates,
            },
        },
    };
}

export function buildFramesFromSliceLines(lines: ManualSliceLines, bounds: ImageBounds): ManualFrameRect[] {
    const normalized = normalizeSliceLines(lines, bounds);
    if (normalized.horizontal.length === 0 && normalized.vertical.length === 0) {
        return [];
    }
    const width = Math.max(1, Math.floor(bounds.width));
    const height = Math.max(1, Math.floor(bounds.height));
    const xStops = [0, ...normalized.vertical, width];
    const yStops = [0, ...normalized.horizontal, height];
    const frames: ManualFrameRect[] = [];

    for (let row = 0; row < yStops.length - 1; row += 1) {
        for (let column = 0; column < xStops.length - 1; column += 1) {
            const x = xStops[column];
            const y = yStops[row];
            const w = xStops[column + 1] - x;
            const h = yStops[row + 1] - y;
            if (w <= 0 || h <= 0) {
                continue;
            }
            frames.push({ h, w, x, y });
        }
    }

    return frames;
}

export function clampFrameRectToBounds(rect: ManualFrameRect, bounds: ImageBounds): ManualFrameRect {
    const width = Math.max(1, Math.floor(bounds.width));
    const height = Math.max(1, Math.floor(bounds.height));
    const x = clampFrameStart(rect.x, width);
    const y = clampFrameStart(rect.y, height);
    const maxWidth = Math.max(1, width - x);
    const maxHeight = Math.max(1, height - y);

    return {
        h: Math.max(1, Math.min(maxHeight, Math.round(rect.h))),
        w: Math.max(1, Math.min(maxWidth, Math.round(rect.w))),
        x,
        y,
    };
}

export function computeFrameListMetrics(density: SpritesheetFrameListDensity, uiScale: number): SpritesheetFrameListMetrics {
    const scale = Number.isFinite(uiScale) && uiScale > 0 ? uiScale : 1;
    const compact = density === 'compact';

    return {
        detailFontSize: Math.max(10, Math.round((compact ? 11 : 12) * scale)),
        itemGap: Math.max(4, Math.round((compact ? 6 : 8) * scale)),
        rowGap: Math.max(4, Math.round((compact ? 4 : 6) * scale)),
        rowMinHeight: Math.max(compact ? 40 : 58, Math.round((compact ? 42 : 66) * scale)),
        rowPadding: Math.max(3, Math.round((compact ? 4 : 6) * scale)),
        thumbnailBoxSize: Math.max(compact ? 30 : 44, Math.round((compact ? 34 : 52) * scale)),
        thumbnailCanvasMaxSize: Math.max(compact ? 28 : 40, Math.round((compact ? 30 : 48) * scale)),
        thumbnailColumnWidth: Math.max(compact ? 34 : 48, Math.round((compact ? 38 : 56) * scale)),
    };
}

export function computeThumbnailCanvasMetrics(
    frame: Pick<SpriteFrame, 'h' | 'w'>,
    maxSize: number,
    dpr: number,
): ThumbnailCanvasMetrics {
    const safeMaxSize = Math.max(1, Math.floor(maxSize));
    const safeDpr = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
    const scale = Math.min(safeMaxSize / Math.max(1, frame.w), safeMaxSize / Math.max(1, frame.h));
    const width = Math.max(1, Math.floor(frame.w * scale));
    const height = Math.max(1, Math.floor(frame.h * scale));

    return {
        height,
        pixelHeight: Math.max(1, Math.floor(height * safeDpr)),
        pixelWidth: Math.max(1, Math.floor(width * safeDpr)),
        width,
    };
}

export function duplicateFrame(
    descriptor: SpritesheetDescriptor,
    existingFrames: Record<string, SpriteFrame>,
    frameName: string,
): { descriptor: SpritesheetDescriptor; frameName: string } | undefined {
    const frame = existingFrames[frameName];
    if (!frame) return undefined;
    const name = nextCopyFrameName(frameName, existingFrames);
    const nextFrames = mergeFrameUpdates(existingFrames, {
        [name]: {
            h: frame.h,
            w: frame.w,
            x: frame.x,
            y: frame.y,
        },
    });

    return {
        descriptor: {
            ...descriptor,
            format: 'atlas',
            frames: nextFrames,
        },
        frameName: name,
    };
}

export function frameAtPoint(entries: Array<[string, SpriteFrame]>, x: number, y: number): string | undefined {
    for (const [name, frame] of entries) {
        if (x >= frame.x && x <= frame.x + frame.w && y >= frame.y && y <= frame.y + frame.h) {
            return name;
        }
    }
    return undefined;
}

export function insertFrameAtIndex(sequence: string[], targetIndex: number, frameName: string): string[] {
    const next = [...sequence];
    const clampedIndex = Math.max(0, Math.min(targetIndex, next.length));
    next.splice(clampedIndex, 0, frameName);
    return next;
}

export function mergeFrameRectUpdate(
    existingFrames: Record<string, SpriteFrame>,
    frameName: string,
    update: Partial<ManualFrameRect>,
    bounds: ImageBounds,
): Record<string, SpriteFrame> {
    const frame = existingFrames[frameName];
    if (!frame) return existingFrames;
    return mergeFrameUpdates(existingFrames, {
        [frameName]: clampFrameRectToBounds({ ...frame, ...update }, bounds),
    });
}

export function mergeFrameUpdates(
    existing: Record<string, SpriteFrame>,
    updates: Record<string, Partial<SpriteFrame> | undefined>,
): Record<string, SpriteFrame> {
    const next = { ...existing };

    for (const [name, update] of Object.entries(updates)) {
        if (update === undefined) {
            delete next[name];
            continue;
        }

        const base = next[name] ?? { h: 0, name, w: 0, x: 0, y: 0 };
        next[name] = {
            ...base,
            ...update,
            name,
        };
    }

    return next;
}

export function moveSequenceFrame(sequence: string[], sourceIndex: number, direction: -1 | 1): string[] {
    const targetIndex = sourceIndex + direction;
    if (sourceIndex < 0 || sourceIndex >= sequence.length || targetIndex < 0 || targetIndex >= sequence.length) {
        return sequence;
    }

    const next = [...sequence];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    return next;
}

export function moveSliceLine(
    lines: ManualSliceLines,
    axis: ManualSliceAxis,
    index: number,
    value: number,
    bounds: ImageBounds,
): ManualSliceLines {
    const key = axis === 'vertical' ? 'vertical' : 'horizontal';
    const current = [...lines[key]];
    if (index < 0 || index >= current.length) {
        return lines;
    }

    current[index] = clampInnerAxis(value, axis === 'vertical' ? bounds.width : bounds.height);
    return {
        ...lines,
        [key]: sortUnique(current),
    };
}

export function nextCopyFrameName(frameName: string, frames: Record<string, SpriteFrame>): string {
    const baseName = `${frameName}_copy`;
    if (!frames[baseName]) return baseName;

    let candidate = 2;
    while (frames[`${baseName}_${candidate}`]) {
        candidate += 1;
    }
    return `${baseName}_${candidate}`;
}

export function nextManualFrameName(frames: Record<string, SpriteFrame>): string {
    const used = new Set<number>();

    for (const key of Object.keys(frames)) {
        const matched = /^manual_frame_(\d+)$/.exec(key);
        if (matched) {
            used.add(Number(matched[1]));
        }
    }

    let candidate = 0;
    while (used.has(candidate)) {
        candidate += 1;
    }

    return `manual_frame_${candidate}`;
}

export function normalizeManualDragFrame(start: Point, end: Point, bounds: ImageBounds): ManualFrameRect | undefined {
    const width = Math.max(1, Math.floor(bounds.width));
    const height = Math.max(1, Math.floor(bounds.height));
    const left = clampAxis(Math.min(start.x, end.x), width);
    const top = clampAxis(Math.min(start.y, end.y), height);
    const right = clampAxis(Math.max(start.x, end.x), width);
    const bottom = clampAxis(Math.max(start.y, end.y), height);

    if (right <= left || bottom <= top) {
        return undefined;
    }

    return {
        h: bottom - top,
        w: right - left,
        x: left,
        y: top,
    };
}

export function removeFrameAtIndex(sequence: string[], index: number): string[] {
    if (index < 0 || index >= sequence.length) return sequence;
    return sequence.filter((_frameName, currentIndex) => currentIndex !== index);
}

export function removeMatchingSequenceFrames(sequence: string[], frameName: string): string[] {
    const next = sequence.filter((candidate) => candidate !== frameName);
    return next.length === sequence.length ? sequence : next;
}

export function reorderSequence(sequence: string[], sourceIndex: number, targetIndex: number): string[] {
    if (sourceIndex < 0 || sourceIndex >= sequence.length || targetIndex < 0 || targetIndex > sequence.length) {
        return sequence;
    }

    if (sourceIndex === targetIndex || sourceIndex + 1 === targetIndex) {
        return sequence;
    }

    const next = [...sequence];
    const [moved] = next.splice(sourceIndex, 1);
    const insertionIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
    next.splice(insertionIndex, 0, moved);
    return next;
}

export function replaceFrameAtIndex(sequence: string[], index: number, frameName: string): string[] {
    if (index < 0 || index >= sequence.length) return sequence;
    const next = [...sequence];
    next[index] = frameName;
    return next;
}

function clampAxis(value: number, size: number): number {
    const clamped = Math.max(0, Math.min(size, value));
    return Math.round(clamped);
}

function clampFrameStart(value: number, size: number): number {
    if (size <= 1) return 0;
    const clamped = Math.max(0, Math.min(size - 1, value));
    return Math.round(clamped);
}

function clampInnerAxis(value: number, size: number): number {
    if (size <= 1) {
        return 0;
    }
    const clamped = clampAxis(value, size);
    return Math.max(1, Math.min(size - 1, clamped));
}

function normalizeSliceLines(lines: ManualSliceLines, bounds: ImageBounds): ManualSliceLines {
    return {
        horizontal: sortUnique(lines.horizontal.map((value) => clampInnerAxis(value, bounds.height))),
        vertical: sortUnique(lines.vertical.map((value) => clampInnerAxis(value, bounds.width))),
    };
}

function sortUnique(values: number[]): number[] {
    return [...new Set(values)].toSorted((a, b) => a - b);
}


import { type SpriteFrame } from 'core';

export type ThumbnailCanvasMetrics = {
    height: number;
    pixelHeight: number;
    pixelWidth: number;
    width: number;
};

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


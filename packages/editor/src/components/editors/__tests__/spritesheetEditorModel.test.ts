import { type SpriteFrame } from 'core';
import { describe, expect, it } from 'vitest';

import {
    computeThumbnailCanvasMetrics,
    frameAtPoint,
    insertFrameAtIndex,
    mergeFrameUpdates,
    reorderSequence,
} from '../spritesheetEditorModel';

describe('spritesheetEditorModel', () => {
    it('computes thumbnail dimensions and device pixels', () => {
        const metrics = computeThumbnailCanvasMetrics({ h: 64, w: 32 }, 48, 2);

        expect(metrics).toEqual({
            height: 48,
            pixelHeight: 96,
            pixelWidth: 48,
            width: 24,
        });
    });

    it('falls back to dpr=1 when dpr is invalid', () => {
        const metrics = computeThumbnailCanvasMetrics({ h: 16, w: 16 }, 24, Number.NaN);

        expect(metrics.pixelWidth).toBe(24);
        expect(metrics.pixelHeight).toBe(24);
    });

    it('returns frame name for inclusive hit-testing bounds', () => {
        const entries: Array<[string, SpriteFrame]> = [
            ['hero', { h: 16, name: 'hero', w: 16, x: 10, y: 20 }],
            ['villain', { h: 8, name: 'villain', w: 8, x: 30, y: 40 }],
        ];

        expect(frameAtPoint(entries, 10, 20)).toBe('hero');
        expect(frameAtPoint(entries, 26, 36)).toBe('hero');
        expect(frameAtPoint(entries, 100, 100)).toBeUndefined();
    });

    it('reorders a sequence using insertion-slot semantics', () => {
        const sequence = ['a', 'b', 'c', 'd'];

        expect(reorderSequence(sequence, 1, 4)).toEqual(['a', 'c', 'd', 'b']);
        expect(reorderSequence(sequence, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
    });

    it('returns the original sequence when reorder is a no-op', () => {
        const sequence = ['a', 'b', 'c'];

        expect(reorderSequence(sequence, 1, 2)).toBe(sequence);
        expect(reorderSequence(sequence, -1, 1)).toBe(sequence);
    });

    it('inserts frames and merges frame updates immutably', () => {
        const inserted = insertFrameAtIndex(['a', 'c'], 1, 'b');
        expect(inserted).toEqual(['a', 'b', 'c']);

        const existing: Record<string, SpriteFrame> = {
            a: { h: 10, name: 'a', w: 10, x: 0, y: 0 },
        };
        const next = mergeFrameUpdates(existing, {
            a: { x: 4 },
            b: { h: 12, w: 8, x: 2, y: 3 },
        });
        const removed = mergeFrameUpdates(next, { a: undefined });

        expect(existing.a.x).toBe(0);
        expect(next).toEqual({
            a: { h: 10, name: 'a', w: 10, x: 4, y: 0 },
            b: { h: 12, name: 'b', w: 8, x: 2, y: 3 },
        });
        expect(removed).toEqual({
            b: { h: 12, name: 'b', w: 8, x: 2, y: 3 },
        });
    });
});


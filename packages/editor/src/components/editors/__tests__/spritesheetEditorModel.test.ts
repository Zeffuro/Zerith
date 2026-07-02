import { type SpriteFrame, type SpritesheetDescriptor } from '@zeffuro/zerith-core';
import { describe, expect, it } from 'vitest';

import {
    addSliceLine,
    applyManualFrame,
    applySliceLineFrames,
    buildFramesFromSliceLines,
    clampFrameRectToBounds,
    computeFrameListMetrics,
    computeThumbnailCanvasMetrics,
    duplicateFrame,
    frameAtPoint,
    insertFrameAtIndex,
    mergeFrameRectUpdate,
    mergeFrameUpdates,
    moveSequenceFrame,
    moveSliceLine,
    nextCopyFrameName,
    nextManualFrameName,
    normalizeManualDragFrame,
    removeFrameAtIndex,
    removeMatchingSequenceFrames,
    reorderSequence,
    replaceFrameAtIndex,
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

    it('computes compact frame list metrics smaller than comfortable rows', () => {
        const comfortable = computeFrameListMetrics('comfortable', 1);
        const compact = computeFrameListMetrics('compact', 1);

        expect(compact.rowMinHeight).toBeLessThan(comfortable.rowMinHeight);
        expect(compact.thumbnailBoxSize).toBeLessThan(comfortable.thumbnailBoxSize);
        expect(compact.thumbnailColumnWidth).toBeLessThan(comfortable.thumbnailColumnWidth);
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

    it('edits animation sequences by active index and matching frame', () => {
        const sequence = ['blink_0', 'blink_1', 'blink_2', 'blink_0'];

        expect(removeFrameAtIndex(sequence, 0)).toEqual(['blink_1', 'blink_2', 'blink_0']);
        expect(removeFrameAtIndex(sequence, -1)).toBe(sequence);
        expect(removeMatchingSequenceFrames(sequence, 'blink_0')).toEqual(['blink_1', 'blink_2']);
        expect(removeMatchingSequenceFrames(sequence, 'missing')).toBe(sequence);
        expect(replaceFrameAtIndex(sequence, 1, 'idle_0')).toEqual(['blink_0', 'idle_0', 'blink_2', 'blink_0']);
        expect(replaceFrameAtIndex(sequence, 99, 'idle_0')).toBe(sequence);
    });

    it('moves animation sequence frames one slot at a time', () => {
        const sequence = ['a', 'b', 'c'];

        expect(moveSequenceFrame(sequence, 1, -1)).toEqual(['b', 'a', 'c']);
        expect(moveSequenceFrame(sequence, 1, 1)).toEqual(['a', 'c', 'b']);
        expect(moveSequenceFrame(sequence, 0, -1)).toBe(sequence);
        expect(moveSequenceFrame(sequence, 2, 1)).toBe(sequence);
    });

    it('normalizes manual drag rectangles and clamps to image bounds', () => {
        const rect = normalizeManualDragFrame({ x: 32.2, y: 16.8 }, { x: -8, y: 64.1 }, { height: 48, width: 40 });

        expect(rect).toEqual({ h: 31, w: 32, x: 0, y: 17 });
        expect(normalizeManualDragFrame({ x: 20, y: 20 }, { x: 20, y: 20 }, { height: 32, width: 32 })).toBeUndefined();
    });

    it('builds frame cells from slice lines with dedupe and sort', () => {
        const frames = buildFramesFromSliceLines(
            { horizontal: [30, 10, 10], vertical: [40, 20, 20] },
            { height: 50, width: 60 },
        );

        expect(frames).toEqual([
            { h: 10, w: 20, x: 0, y: 0 },
            { h: 10, w: 20, x: 20, y: 0 },
            { h: 10, w: 20, x: 40, y: 0 },
            { h: 20, w: 20, x: 0, y: 10 },
            { h: 20, w: 20, x: 20, y: 10 },
            { h: 20, w: 20, x: 40, y: 10 },
            { h: 20, w: 20, x: 0, y: 30 },
            { h: 20, w: 20, x: 20, y: 30 },
            { h: 20, w: 20, x: 40, y: 30 },
        ]);
    });

    it('generates manual frame names using the first open index', () => {
        const frames: Record<string, SpriteFrame> = {
            hero: { h: 16, name: 'hero', w: 16, x: 0, y: 0 },
            manual_frame_0: { h: 16, name: 'manual_frame_0', w: 16, x: 0, y: 0 },
            manual_frame_2: { h: 16, name: 'manual_frame_2', w: 16, x: 16, y: 0 },
        };

        expect(nextManualFrameName(frames)).toBe('manual_frame_1');
    });

    it('switches grid descriptors to atlas when manual frames are created', () => {
        const descriptor: SpritesheetDescriptor = {
            format: 'grid',
            frameHeight: 16,
            frameWidth: 16,
            source: 'sprites.png',
        };
        const existingFrames: Record<string, SpriteFrame> = {
            frame_0: { h: 16, name: 'frame_0', w: 16, x: 0, y: 0 },
        };

        const result = applyManualFrame(descriptor, existingFrames, { h: 14, w: 12, x: 3, y: 4 });

        expect(result.frameName).toBe('manual_frame_0');
        expect(result.descriptor.format).toBe('atlas');
        expect(result.descriptor.frames).toMatchObject({
            frame_0: { h: 16, name: 'frame_0', w: 16, x: 0, y: 0 },
            manual_frame_0: { h: 14, name: 'manual_frame_0', w: 12, x: 3, y: 4 },
        });
    });

    it('adds and moves slice lines within inner image bounds', () => {
        const started = addSliceLine({ horizontal: [], vertical: [] }, 'vertical', 0, { height: 80, width: 100 });
        const moved = moveSliceLine(started, 'vertical', 0, 150, { height: 80, width: 100 });

        expect(started.vertical).toEqual([1]);
        expect(moved.vertical).toEqual([99]);
    });

    it('clamps frame rect edits to source image bounds', () => {
        const rect = clampFrameRectToBounds({ h: 100, w: 100, x: 48.4, y: -3 }, { height: 40, width: 50 });

        expect(rect).toEqual({ h: 40, w: 2, x: 48, y: 0 });
    });

    it('merges frame rect edits immutably', () => {
        const existing: Record<string, SpriteFrame> = {
            idle: { h: 10, name: 'idle', w: 10, x: 2, y: 3 },
        };

        const next = mergeFrameRectUpdate(existing, 'idle', { h: 40, x: 18, y: 4 }, { height: 20, width: 24 });

        expect(existing.idle).toEqual({ h: 10, name: 'idle', w: 10, x: 2, y: 3 });
        expect(next.idle).toEqual({ h: 16, name: 'idle', w: 6, x: 18, y: 4 });
        expect(mergeFrameRectUpdate(existing, 'missing', { x: 0 }, { height: 20, width: 20 })).toBe(existing);
    });

    it('duplicates frames with copy names and atlas output', () => {
        const descriptor: SpritesheetDescriptor = {
            format: 'grid',
            frameHeight: 16,
            frameWidth: 16,
            source: 'sprites.png',
        };
        const existing: Record<string, SpriteFrame> = {
            idle: { h: 10, name: 'idle', w: 12, x: 2, y: 3 },
            idle_copy: { h: 10, name: 'idle_copy', w: 12, x: 2, y: 3 },
        };

        expect(nextCopyFrameName('idle', existing)).toBe('idle_copy_2');
        const result = duplicateFrame(descriptor, existing, 'idle');

        expect(result?.frameName).toBe('idle_copy_2');
        expect(result?.descriptor.format).toBe('atlas');
        expect(result?.descriptor.frames?.idle_copy_2).toEqual({ h: 10, name: 'idle_copy_2', w: 12, x: 2, y: 3 });
        expect(duplicateFrame(descriptor, existing, 'missing')).toBeUndefined();
    });

    it('applies slice line grid frames and keeps descriptor unchanged for empty results', () => {
        const descriptor: SpritesheetDescriptor = {
            format: 'atlas',
            frames: { idle: { h: 10, name: 'idle', w: 10, x: 0, y: 0 } },
            source: 'sprites.png',
        };

        const applied = applySliceLineFrames(
            descriptor,
            descriptor.frames ?? {},
            { horizontal: [12], vertical: [16] },
            { height: 24, width: 32 },
        );

        expect(applied.createdNames.length).toBe(4);
        expect(applied.descriptor.frames?.idle).toBeDefined();
        expect(applied.descriptor.frames?.[applied.createdNames[0]]).toBeDefined();

        const unchanged = applySliceLineFrames(descriptor, descriptor.frames ?? {}, { horizontal: [], vertical: [] }, { height: 0, width: 0 });
        expect(unchanged.createdNames).toEqual([]);
        expect(unchanged.descriptor).toBe(descriptor);
    });
});


import { describe, expect, it } from 'vitest';

import { spritesheetDescriptor } from '../test-utils/scriptBuilders';
import { generateGridFrames, normalizeGridToAtlas, suggestGridDimensions } from '../utils/sheetGridUtilities';

describe('sheetGridUtilities', () => {
    it('generateGridFrames creates 64 named frames for a 256x256 sheet with 32x32 frames', () => {
        const frames = generateGridFrames(256, 256, 32, 32);
        const names = Object.keys(frames);

        expect(names).toHaveLength(64);
        expect(names[0]).toBe('frame_0');
        expect(names.at(-1)).toBe('frame_63');
        expect(frames.frame_0).toEqual({
            h: 32,
            name: 'frame_0',
            w: 32,
            x: 0,
            y: 0,
        });
        expect(frames.frame_63).toEqual({
            h: 32,
            name: 'frame_63',
            w: 32,
            x: 224,
            y: 224,
        });
    });

    it('generateGridFrames applies margin and spacing correctly', () => {
        const frames = generateGridFrames(20, 20, 3, 3, { margin: 2, prefix: 'tile', spacing: 1 });

        expect(Object.keys(frames)).toHaveLength(16);
        expect(frames.tile_0).toEqual({
            h: 3,
            name: 'tile_0',
            w: 3,
            x: 2,
            y: 2,
        });
        expect(frames.tile_1.x).toBe(6);
        expect(frames.tile_4.y).toBe(6);
        expect(frames.tile_15).toEqual({
            h: 3,
            name: 'tile_15',
            w: 3,
            x: 14,
            y: 14,
        });
    });

    it('generateGridFrames only emits full frames when image is not evenly divisible', () => {
        const frames = generateGridFrames(100, 70, 32, 32);

        expect(Object.keys(frames)).toHaveLength(6);
        expect(frames.frame_5).toEqual({
            h: 32,
            name: 'frame_5',
            w: 32,
            x: 64,
            y: 32,
        });
    });

    it('suggestGridDimensions returns sensible candidates for 256x256', () => {
        const suggestions = suggestGridDimensions(256, 256);

        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions).toContainEqual({
            cols: 8,
            frameHeight: 32,
            frameWidth: 32,
            rows: 8,
        });
        expect(suggestions.every((candidate) => {
            const frameCount = candidate.cols * candidate.rows;

            return frameCount >= 2 && frameCount <= 64;
        })).toBe(true);
    });

    it('normalizeGridToAtlas converts a grid descriptor into atlas frames', () => {
        const descriptor = spritesheetDescriptor({
            animations: {
                idle: ['frame_0', 'frame_1'],
            },
            margin: 2,
            spacing: 2,
        });

        const normalized = normalizeGridToAtlas(descriptor, 196, 196);

        expect(normalized.format).toBe('atlas');
        expect(normalized.source).toBe(descriptor.source);
        expect(normalized.animations).toEqual(descriptor.animations);
        expect(normalized.frames).toBeDefined();
        expect(Object.keys(normalized.frames ?? {})).toHaveLength(4);
        expect(normalized.frames?.frame_3).toEqual({
            h: 64,
            name: 'frame_3',
            w: 64,
            x: 68,
            y: 68,
        });
    });
});



import { describe, expect, it } from 'vitest';

import { createSliceHarness } from '../test-utils/createSliceHarness';
import {
    detectDescriptorType,
    getAssetPathFromDescriptor,
    getSheetDescriptorCandidatePaths,
    getSheetDescriptorPath,
    isSheetDescriptor,
} from '../utils/assetDescriptorUtilities';

describe('assetDescriptorUtilities', () => {
    it('getSheetDescriptorPath converts a sprite image path', () => {
        expect(getSheetDescriptorPath('sprites/hero.png')).toBe('sprites/hero.sheet.json');
    });

    it('getSheetDescriptorPath converts an audio path', () => {
        expect(getSheetDescriptorPath('audio/sfx.ogg')).toBe('audio/sfx.sheet.json');
    });

    it('getAssetPathFromDescriptor strips .sheet.json suffix', () => {
        expect(getAssetPathFromDescriptor('sprites/hero.sheet.json')).toBe('sprites/hero');
    });

    it('getAssetPathFromDescriptor leaves non-canonical descriptor suffixes unchanged', () => {
        expect(getAssetPathFromDescriptor('sprites/hero.atlas.json')).toBe('sprites/hero.atlas.json');
    });

    it('getSheetDescriptorCandidatePaths returns only canonical descriptor paths', () => {
        expect(getSheetDescriptorCandidatePaths('sprites/hero.png')).toEqual(['sprites/hero.sheet.json']);
    });

    it('isSheetDescriptor returns true only for canonical descriptor names', () => {
        expect(isSheetDescriptor('hero.sheet.json')).toBe(true);
        expect(isSheetDescriptor('hero.atlas.json')).toBe(false);
        expect(isSheetDescriptor('hero.json')).toBe(false);
        expect(isSheetDescriptor('hero.png')).toBe(false);
    });

    it('detectDescriptorType identifies spritesheet payloads', () => {
        const harness = createSliceHarness({
            payload: {
                format: 'aseprite',
                source: 'sprites/hero.png',
            },
        });

        expect(detectDescriptorType(harness.get().payload)).toBe('spritesheet');
    });

    it('detectDescriptorType identifies audiosheet payloads', () => {
        expect(
            detectDescriptorType({
                cues: { intro: [0, 1200] },
                source: 'bgm/theme.mp3',
            }),
        ).toBe('audiosheet');
    });

    it('detectDescriptorType returns unknown for unsupported data', () => {
        expect(detectDescriptorType({ random: true })).toBe('unknown');
    });
});



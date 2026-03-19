import { describe, expect, it } from 'vitest';

import { parseAudiosheetDescriptor, parseSheetDescriptor, parseSpritesheetDescriptor } from '../schemas/descriptorSchemas';
import { audiosheetDescriptor, spritesheetDescriptor } from '../test-utils/scriptBuilders';

describe('descriptorSchemas', () => {
    it('parses a valid spritesheet descriptor in grid format', () => {
        const input = spritesheetDescriptor();

        const parsed = parseSpritesheetDescriptor(input);

        expect(parsed.success).toBe(true);
        expect(parsed).toMatchObject({
            data: {
                format: 'grid',
                frameHeight: 64,
                frameWidth: 64,
                source: 'assets/sprites/hero.png',
            },
            success: true,
        });
    });

    it('parses a valid spritesheet descriptor in atlas format with explicit frames', () => {
        const input = spritesheetDescriptor({
            format: 'atlas',
            frameHeight: undefined,
            frames: {
                idle_0: {
                    h: 64,
                    name: 'idle_0',
                    w: 64,
                    x: 0,
                    y: 0,
                },
                idle_1: {
                    h: 64,
                    name: 'idle_1',
                    w: 64,
                    x: 64,
                    y: 0,
                },
            },
            frameWidth: undefined,
        });

        const parsed = parseSpritesheetDescriptor(input);

        expect(parsed.success).toBe(true);
        expect(parsed).toMatchObject({
            data: {
                format: 'atlas',
                source: 'assets/sprites/hero.png',
            },
            success: true,
        });
    });

    it('parses a valid audiosheet descriptor', () => {
        const input = audiosheetDescriptor({
            cues: {
                objection: {
                    duration: 1.4,
                    start: 2.5,
                    volume: 0.9,
                },
            },
            source: 'assets/bgm/court.mp3',
        });

        const parsed = parseAudiosheetDescriptor(input);

        expect(parsed.success).toBe(true);
        expect(parsed).toMatchObject({
            data: {
                cues: {
                    objection: {
                        duration: 1.4,
                        start: 2.5,
                        volume: 0.9,
                    },
                },
                source: 'assets/bgm/court.mp3',
            },
            success: true,
        });
    });

    it('returns an error when source is missing', () => {
        const input = {
            format: 'grid',
            frameHeight: 48,
            frameWidth: 48,
        };

        const parsed = parseSpritesheetDescriptor(input);

        expect(parsed.success).toBe(false);
        if (!parsed.success) {
            expect(parsed.error).toContain('source');
        }
    });

    it('returns an error for invalid frame coordinates', () => {
        const input = spritesheetDescriptor({
            format: 'atlas',
            frameHeight: undefined,
            frames: {
                bad_frame: {
                    h: -10,
                    name: 'bad_frame',
                    w: -8,
                    x: 0,
                    y: 0,
                },
            },
            frameWidth: undefined,
        });

        const parsed = parseSpritesheetDescriptor(input);

        expect(parsed.success).toBe(false);
        if (!parsed.success) {
            expect(parsed.error).toMatch(/frames\.bad_frame\.[wh]/u);
        }
    });

    it('returns an error for an invalid cue with negative start', () => {
        const input = audiosheetDescriptor({
            cues: {
                stinger: {
                    start: -0.01,
                },
            },
        });

        const parsed = parseAudiosheetDescriptor(input);

        expect(parsed.success).toBe(false);
        if (!parsed.success) {
            expect(parsed.error).toContain('cues.stinger.start');
        }
    });

    it('parses canonical sheet descriptors for spritesheets and audiosheets', () => {
        const parsedSpritesheet = parseSheetDescriptor(spritesheetDescriptor());
        const parsedAudiosheet = parseSheetDescriptor(audiosheetDescriptor());

        expect(parsedSpritesheet.success).toBe(true);
        expect(parsedAudiosheet.success).toBe(true);
    });

    it('returns an error for non-sheet payloads in canonical sheet parser', () => {
        const parsed = parseSheetDescriptor({ source: 'asset.bin' });

        expect(parsed.success).toBe(false);
    });
});


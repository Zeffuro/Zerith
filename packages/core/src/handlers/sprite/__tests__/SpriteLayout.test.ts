import { describe, expect, it } from 'vitest';

import { resolveSpritePlacement } from '../SpriteLayout';

describe('resolveSpritePlacement', () => {
    it('resolves ratio positions against the current display size', () => {
        const placement = resolveSpritePlacement({
            command: {
                action: 'show',
                id: 'juno',
                type: 'sprite',
            },
            defaults: {
                xRatio: 0.25,
                yRatio: 0.75,
            },
            displayHeight: 720,
            displayWidth: 1280,
        });

        expect(placement.x).toBe(320);
        expect(placement.y).toBe(540);
    });

    it('lets explicit command coordinates override ratio defaults', () => {
        const placement = resolveSpritePlacement({
            command: {
                action: 'show',
                id: 'juno',
                type: 'sprite',
                x: 100,
                yRatio: 0.5,
            },
            defaults: {
                xRatio: 0.25,
                y: 700,
            },
            displayHeight: 720,
            displayWidth: 1280,
        });

        expect(placement.x).toBe(100);
        expect(placement.y).toBe(360);
    });

    it('applies flip to resolved scale values without changing y scale', () => {
        const placement = resolveSpritePlacement({
            command: {
                action: 'show',
                id: 'may',
                type: 'sprite',
            },
            defaults: {
                flip: true,
                scaleX: 1.25,
                scaleY: 1.5,
            },
            displayHeight: 720,
            displayWidth: 1280,
        });

        expect(placement.flip).toBe(true);
        expect(placement.scaleX).toBe(-1.25);
        expect(placement.scaleY).toBe(1.5);
    });
});

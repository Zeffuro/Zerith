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

    it('fits sprite size to display ratios using contain by default', () => {
        const placement = resolveSpritePlacement({
            command: {
                action: 'show',
                id: 'juno',
                type: 'sprite',
            },
            defaults: {
                heightRatio: 0.5,
                widthRatio: 0.4,
            },
            displayHeight: 720,
            displayWidth: 1280,
            textureHeight: 800,
            textureWidth: 400,
        });

        expect(placement.scaleX).toBe(0.45);
        expect(placement.scaleY).toBe(0.45);
    });

    it('supports cover and stretch fit modes for ratio sizing', () => {
        const coverPlacement = resolveSpritePlacement({
            command: {
                action: 'show',
                fit: 'cover',
                heightRatio: 0.5,
                id: 'juno',
                type: 'sprite',
                widthRatio: 0.4,
            },
            defaults: undefined,
            displayHeight: 720,
            displayWidth: 1280,
            textureHeight: 800,
            textureWidth: 400,
        });
        const stretchPlacement = resolveSpritePlacement({
            command: {
                action: 'show',
                fit: 'stretch',
                heightRatio: 0.5,
                id: 'juno',
                type: 'sprite',
                widthRatio: 0.4,
            },
            defaults: undefined,
            displayHeight: 720,
            displayWidth: 1280,
            textureHeight: 800,
            textureWidth: 400,
        });

        expect(coverPlacement.scaleX).toBe(1.28);
        expect(coverPlacement.scaleY).toBe(1.28);
        expect(stretchPlacement.scaleX).toBe(1.28);
        expect(stretchPlacement.scaleY).toBe(0.45);
    });

    it('lets explicit scale override ratio sizing', () => {
        const placement = resolveSpritePlacement({
            command: {
                action: 'show',
                heightRatio: 0.5,
                id: 'juno',
                scaleX: 0.75,
                scaleY: 0.8,
                type: 'sprite',
            },
            defaults: undefined,
            displayHeight: 720,
            displayWidth: 1280,
            textureHeight: 800,
            textureWidth: 400,
        });

        expect(placement.scaleX).toBe(0.75);
        expect(placement.scaleY).toBe(0.8);
    });
});

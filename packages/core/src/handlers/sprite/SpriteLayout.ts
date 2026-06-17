import type { DisplayDefaults } from '../../types';
import type { SpriteCommand } from './types';

export interface SpritePlacement {
    anchorX: number;
    anchorY: number;
    flip: boolean;
    scaleX: number | undefined;
    scaleY: number | undefined;
    x: number;
    y: number;
}

export function resolveSpritePlacement(options: {
    command: SpriteCommand;
    defaults: DisplayDefaults | undefined;
    displayHeight: number;
    displayWidth: number;
}): SpritePlacement {
    const { command, defaults, displayHeight, displayWidth } = options;
    const flip = command.flip ?? defaults?.flip ?? false;
    const scaleX = command.scaleX ?? defaults?.scaleX;
    const scaleY = command.scaleY ?? defaults?.scaleY;

    return {
        anchorX: command.anchorX ?? defaults?.anchorX ?? 0.5,
        anchorY: command.anchorY ?? defaults?.anchorY ?? 1,
        flip,
        scaleX: flip && scaleX !== undefined ? -Math.abs(scaleX) : scaleX,
        scaleY,
        x: resolveAxisPosition({
            defaultAbsoluteValue: defaults?.x,
            defaultRatioValue: defaults?.xRatio,
            displaySize: displayWidth,
            fallback: displayWidth / 2,
            overrideAbsoluteValue: command.x,
            overrideRatioValue: command.xRatio,
        }),
        y: resolveAxisPosition({
            defaultAbsoluteValue: defaults?.y,
            defaultRatioValue: defaults?.yRatio,
            displaySize: displayHeight,
            fallback: displayHeight,
            overrideAbsoluteValue: command.y,
            overrideRatioValue: command.yRatio,
        }),
    };
}

function resolveAxisPosition(options: {
    defaultAbsoluteValue: number | undefined;
    defaultRatioValue: number | undefined;
    displaySize: number;
    fallback: number;
    overrideAbsoluteValue: number | undefined;
    overrideRatioValue: number | undefined;
}): number {
    if (options.overrideAbsoluteValue !== undefined) {
        return options.overrideAbsoluteValue;
    }

    if (options.overrideRatioValue !== undefined) {
        return options.displaySize * options.overrideRatioValue;
    }

    if (options.defaultAbsoluteValue !== undefined) {
        return options.defaultAbsoluteValue;
    }

    if (options.defaultRatioValue !== undefined) {
        return options.displaySize * options.defaultRatioValue;
    }

    return options.fallback;
}

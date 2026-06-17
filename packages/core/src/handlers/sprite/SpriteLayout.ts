import type { DisplayDefaults, SpriteFitMode } from '../../types';
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
    textureHeight?: number;
    textureWidth?: number;
}): SpritePlacement {
    const { command, defaults, displayHeight, displayWidth, textureHeight, textureWidth } = options;
    const flip = command.flip ?? defaults?.flip ?? false;
    const { scaleX, scaleY } = resolveSpriteScale({
        command,
        defaults,
        displayHeight,
        displayWidth,
        textureHeight,
        textureWidth,
    });

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

function resolveRatioScale(options: {
    displayHeight: number;
    displayWidth: number;
    fit: SpriteFitMode;
    heightRatio: number | undefined;
    textureHeight: number | undefined;
    textureWidth: number | undefined;
    widthRatio: number | undefined;
}): { scaleX: number | undefined; scaleY: number | undefined } {
    const { displayHeight, displayWidth, fit, heightRatio, textureHeight, textureWidth, widthRatio } = options;
    if (!textureWidth || !textureHeight) return { scaleX: undefined, scaleY: undefined };

    const targetWidth = widthRatio === undefined ? undefined : displayWidth * widthRatio;
    const targetHeight = heightRatio === undefined ? undefined : displayHeight * heightRatio;

    if (targetWidth === undefined && targetHeight === undefined) {
        return { scaleX: undefined, scaleY: undefined };
    }

    if (targetWidth !== undefined && targetHeight !== undefined) {
        const scaleX = targetWidth / textureWidth;
        const scaleY = targetHeight / textureHeight;

        if (fit === 'stretch') {
            return { scaleX, scaleY };
        }

        const uniformScale = fit === 'cover'
            ? Math.max(scaleX, scaleY)
            : Math.min(scaleX, scaleY);
        return { scaleX: uniformScale, scaleY: uniformScale };
    }

    if (targetWidth !== undefined) {
        const uniformScale = targetWidth / textureWidth;
        return { scaleX: uniformScale, scaleY: uniformScale };
    }

    if (targetHeight === undefined) {
        return { scaleX: undefined, scaleY: undefined };
    }

    const uniformScale = targetHeight / textureHeight;
    return { scaleX: uniformScale, scaleY: uniformScale };
}

function resolveSpriteScale(options: {
    command: SpriteCommand;
    defaults: DisplayDefaults | undefined;
    displayHeight: number;
    displayWidth: number;
    textureHeight: number | undefined;
    textureWidth: number | undefined;
}): { scaleX: number | undefined; scaleY: number | undefined } {
    const { command, defaults, displayHeight, displayWidth, textureHeight, textureWidth } = options;
    const explicitScaleX = command.scaleX ?? defaults?.scaleX;
    const explicitScaleY = command.scaleY ?? defaults?.scaleY;
    const ratioScale = resolveRatioScale({
        displayHeight,
        displayWidth,
        fit: command.fit ?? defaults?.fit ?? 'contain',
        heightRatio: command.heightRatio ?? defaults?.heightRatio,
        textureHeight,
        textureWidth,
        widthRatio: command.widthRatio ?? defaults?.widthRatio,
    });

    return {
        scaleX: explicitScaleX ?? ratioScale.scaleX,
        scaleY: explicitScaleY ?? ratioScale.scaleY,
    };
}

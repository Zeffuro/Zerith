import type { SpriteFrame, SpritesheetDescriptor } from '../types';

interface GridOptions {
    margin?: number;
    prefix?: string;
    spacing?: number;
}

/**
 * Generate frame rectangles from grid parameters.
 * Returns Record<string, SpriteFrame> where keys are "{prefix}_{index}".
 */
export function generateGridFrames(
    imageWidth: number,
    imageHeight: number,
    frameWidth: number,
    frameHeight: number,
    options: GridOptions = {},
): Record<string, SpriteFrame> {
    if (imageWidth <= 0 || imageHeight <= 0 || frameWidth <= 0 || frameHeight <= 0) {
        return {};
    }

    const margin = options.margin ?? 0;
    const spacing = options.spacing ?? 0;
    const prefix = options.prefix ?? 'frame';

    if (margin < 0 || spacing < 0) {
        return {};
    }

    const maxX = imageWidth - margin;
    const maxY = imageHeight - margin;
    const stepX = frameWidth + spacing;
    const stepY = frameHeight + spacing;

    if (stepX <= 0 || stepY <= 0) {
        return {};
    }

    const frames: Record<string, SpriteFrame> = {};
    let index = 0;

    for (let y = margin; y + frameHeight <= maxY; y += stepY) {
        for (let x = margin; x + frameWidth <= maxX; x += stepX) {
            const name = `${prefix}_${index}`;

            frames[name] = {
                h: frameHeight,
                name,
                w: frameWidth,
                x,
                y,
            };

            index += 1;
        }
    }

    return frames;
}

/**
 * Convert a SpritesheetDescriptor with format:'grid' to one with explicit frames.
 */
export function normalizeGridToAtlas(
    descriptor: SpritesheetDescriptor,
    imageWidth: number,
    imageHeight: number,
): SpritesheetDescriptor {
    if (descriptor.format !== 'grid' || descriptor.frameWidth === undefined || descriptor.frameHeight === undefined) {
        return descriptor;
    }

    const { frameHeight, frameWidth, margin, spacing, ...rest } = descriptor;

    return {
        ...rest,
        format: 'atlas',
        frames: generateGridFrames(imageWidth, imageHeight, frameWidth, frameHeight, {
            margin,
            spacing,
        }),
    };
}

/**
 * Suggest grid dimensions based on image size.
 * Returns likely frame sizes (common divisors that produce reasonable frame counts 2-64).
 */
export function suggestGridDimensions(
    imageWidth: number,
    imageHeight: number,
): Array<{ cols: number; frameHeight: number; frameWidth: number; rows: number }> {
    if (imageWidth <= 0 || imageHeight <= 0) {
        return [];
    }

    const suggestions: Array<{ cols: number; frameHeight: number; frameWidth: number; rows: number }> = [];

    for (const frameWidth of getDivisors(imageWidth)) {
        for (const frameHeight of getDivisors(imageHeight)) {
            const cols = imageWidth / frameWidth;
            const rows = imageHeight / frameHeight;
            const totalFrames = cols * rows;

            if (totalFrames >= 2 && totalFrames <= 64) {
                suggestions.push({
                    cols,
                    frameHeight,
                    frameWidth,
                    rows,
                });
            }
        }
    }

    return suggestions.toSorted((a, b) => {
        const aSquareDelta = Math.abs(a.frameWidth - a.frameHeight);
        const bSquareDelta = Math.abs(b.frameWidth - b.frameHeight);

        if (aSquareDelta !== bSquareDelta) {
            return aSquareDelta - bSquareDelta;
        }

        const aTotal = a.cols * a.rows;
        const bTotal = b.cols * b.rows;

        if (aTotal !== bTotal) {
            return bTotal - aTotal;
        }

        return a.frameWidth - b.frameWidth;
    });
}

function getDivisors(value: number): number[] {
    const divisors: number[] = [];

    for (let divisor = 1; divisor <= value; divisor += 1) {
        if (value % divisor === 0) {
            divisors.push(divisor);
        }
    }

    return divisors;
}



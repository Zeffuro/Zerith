import type { TextStyleOptions } from 'pixi.js';

export interface DialogueLayoutConfig {
    boxHeight?: number;
    boxWidth?: number;
    boxX?: number;
    boxY?: number;
    messageStyle?: Partial<TextStyleOptions>;
    nameStyle?: Partial<TextStyleOptions>;
}

export interface DialogueLayoutMetrics {
    boxHeight: number;
    boxWidth: number;
    boxX: number;
    boxY: number;
    messageFontSize: number;
    messageHeight: number;
    messageWidth: number;
    messageX: number;
    messageY: number;
    nameFontSize: number;
    nameX: number;
    nameY: number;
    padding: number;
    portraitBaselineY: number;
    portraitLeftX: number;
    portraitMaxHeight: number;
    portraitMaxWidth: number;
    portraitRightX: number;
}

export function calculateDialogueLayout(options: {
    config: DialogueLayoutConfig;
    displayHeight: number;
    displayWidth: number;
}): DialogueLayoutMetrics {
    const displayWidth = Math.max(1, options.displayWidth);
    const displayHeight = Math.max(1, options.displayHeight);
    const minDimension = Math.min(displayWidth, displayHeight);
    const margin = clamp(Math.round(minDimension * 0.028), 12, 24);
    const padding = clamp(Math.round(minDimension * 0.028), 12, 24);

    const maxBoxWidth = Math.max(1, displayWidth - margin * 2);
    const maxBoxHeight = Math.max(1, displayHeight - margin * 2);
    const defaultBoxHeight = Math.max(displayHeight * 0.3, Math.min(160, displayHeight * 0.45));
    const boxWidth = clamp(options.config.boxWidth ?? maxBoxWidth, 1, maxBoxWidth);
    const boxHeight = clamp(options.config.boxHeight ?? defaultBoxHeight, 1, maxBoxHeight);
    const boxX = clamp(options.config.boxX ?? margin, 0, Math.max(0, displayWidth - boxWidth));
    const boxY = clamp(options.config.boxY ?? (displayHeight - boxHeight - margin), 0, Math.max(0, displayHeight - boxHeight));

    const messageBaseFontSize = coerceFontSize(options.config.messageStyle?.fontSize, 28);
    const nameBaseFontSize = coerceFontSize(options.config.nameStyle?.fontSize, Math.max(32, messageBaseFontSize + 4));
    const availableTextHeight = Math.max(1, boxHeight - padding * 2);
    const nameFontSize = clamp(nameBaseFontSize, 10, Math.max(10, availableTextHeight * 0.36));
    const messageFontSize = clamp(messageBaseFontSize, 10, Math.max(10, availableTextHeight * 0.32));

    const nameX = boxX + padding;
    const nameY = boxY + padding * 0.75;
    const messageX = boxX + padding;
    const messageY = nameY + nameFontSize * 1.35;
    const messageWidth = Math.max(1, boxWidth - padding * 2);
    const messageHeight = Math.max(1, boxY + boxHeight - padding - messageY);

    return {
        boxHeight,
        boxWidth,
        boxX,
        boxY,
        messageFontSize,
        messageHeight,
        messageWidth,
        messageX,
        messageY,
        nameFontSize,
        nameX,
        nameY,
        padding,
        portraitBaselineY: boxY,
        portraitLeftX: displayWidth * 0.2,
        portraitMaxHeight: Math.max(1, boxY * 0.9),
        portraitMaxWidth: Math.max(1, displayWidth * 0.38),
        portraitRightX: displayWidth * 0.8,
    };
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function coerceFontSize(value: TextStyleOptions['fontSize'] | undefined, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string') {
        const parsed = Number.parseFloat(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return fallback;
}

import { suggestGridDimensions } from 'zerith-core';

export type AutoSliceGridValues = {
    columns: number;
    frameHeight: number;
    frameWidth: number;
    rows: number;
};

export function clampPositive(value: number): number {
    if (!Number.isFinite(value)) return 1;
    return Math.max(1, Math.floor(value));
}

export function getFrameSizeFromGridSize(
    imageWidth: number,
    imageHeight: number,
    nextColumns: number,
    nextRows: number,
): AutoSliceGridValues {
    const safeColumns = clampPositive(nextColumns);
    const safeRows = clampPositive(nextRows);

    return {
        columns: safeColumns,
        frameHeight: Math.max(1, Math.floor(imageHeight / safeRows)),
        frameWidth: Math.max(1, Math.floor(imageWidth / safeColumns)),
        rows: safeRows,
    };
}

export function getGridSizeFromFrameSize(
    imageWidth: number,
    imageHeight: number,
    nextWidth: number,
    nextHeight: number,
): AutoSliceGridValues {
    const frameWidth = clampPositive(nextWidth);
    const frameHeight = clampPositive(nextHeight);

    return {
        columns: Math.max(1, Math.floor(imageWidth / frameWidth)),
        frameHeight,
        frameWidth,
        rows: Math.max(1, Math.floor(imageHeight / frameHeight)),
    };
}

export function getInitialGridValues(width: number, height: number): AutoSliceGridValues {
    const firstSuggestion = suggestGridDimensions(width, height)[0];
    if (firstSuggestion) {
        return {
            columns: firstSuggestion.cols,
            frameHeight: firstSuggestion.frameHeight,
            frameWidth: firstSuggestion.frameWidth,
            rows: firstSuggestion.rows,
        };
    }

    return {
        columns: 1,
        frameHeight: height,
        frameWidth: width,
        rows: 1,
    };
}

export function getSuggestedGridValues(width: number, height: number): AutoSliceGridValues | undefined {
    const suggestion = suggestGridDimensions(width, height)[0];
    if (!suggestion) {
        return undefined;
    }

    return {
        columns: suggestion.cols,
        frameHeight: suggestion.frameHeight,
        frameWidth: suggestion.frameWidth,
        rows: suggestion.rows,
    };
}


import { type SpriteFrame } from 'core';

import type { SliceHandle } from './spritesheetCanvasInteraction';
import type { ManualFrameRect, ManualSliceLines } from './spritesheetEditorModel';

import { editorTheme as t } from '../../theme/editorTheme';

type DrawFrameOverlayOptions = {
    hoveredFrame?: string;
    selectedFrame?: string;
    uiScale: number;
    zoom: number;
};

export function drawFrameOverlays(
    context: CanvasRenderingContext2D,
    frameEntries: Array<[string, SpriteFrame]>,
    options: DrawFrameOverlayOptions,
): void {
    for (const [name, frame] of frameEntries) {
        const isSelected = options.selectedFrame === name;
        const isHovered = options.hoveredFrame === name;
        drawFrameOverlay(context, name, frame, { isHovered, isSelected, uiScale: options.uiScale, zoom: options.zoom });
    }
}

export function drawGrid(
    context: CanvasRenderingContext2D,
    imageWidth: number,
    imageHeight: number,
    entries: Array<[string, SpriteFrame]>,
): void {
    if (entries.length === 0) return;

    const frame = entries[0][1];
    if (frame.w <= 0 || frame.h <= 0) return;

    context.save();
    context.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    context.lineWidth = 1;

    for (let x = 0; x <= imageWidth; x += frame.w) {
        context.beginPath();
        context.moveTo(x + 0.5, 0);
        context.lineTo(x + 0.5, imageHeight);
        context.stroke();
    }

    for (let y = 0; y <= imageHeight; y += frame.h) {
        context.beginPath();
        context.moveTo(0, y + 0.5);
        context.lineTo(imageWidth, y + 0.5);
        context.stroke();
    }

    context.restore();
}

export function drawImageBackdrop(
    context: CanvasRenderingContext2D,
    imageWidth: number,
    imageHeight: number,
    zoom: number,
): void {
    const tileSize = 16;
    context.save();
    for (let y = 0; y < imageHeight; y += tileSize) {
        for (let x = 0; x < imageWidth; x += tileSize) {
            context.fillStyle = ((x / tileSize + y / tileSize) % 2 === 0) ? '#171a20' : '#20242c';
            context.fillRect(x, y, Math.min(tileSize, imageWidth - x), Math.min(tileSize, imageHeight - y));
        }
    }
    context.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    context.lineWidth = Math.max(1 / zoom, 0.5 / zoom);
    context.strokeRect(0, 0, imageWidth, imageHeight);
    context.restore();
}

export function drawSelection(context: CanvasRenderingContext2D, rect: ManualFrameRect, zoom: number): void {
    context.save();
    context.lineWidth = Math.max(1 / zoom, 0.75 / zoom);
    context.strokeStyle = 'rgba(245, 158, 11, 0.95)';
    context.fillStyle = 'rgba(245, 158, 11, 0.22)';
    context.fillRect(rect.x, rect.y, rect.w, rect.h);
    context.strokeRect(rect.x, rect.y, rect.w, rect.h);
    context.restore();
}

export function drawSliceLines(
    context: CanvasRenderingContext2D,
    options: {
        imageHeight: number;
        imageWidth: number;
        lines: ManualSliceLines;
        previewFrames: ManualFrameRect[];
        selectedHandle?: SliceHandle;
        zoom: number;
    },
): void {
    const lineWidth = 1 / options.zoom;

    context.save();
    context.lineWidth = lineWidth;

    for (const frame of options.previewFrames) {
        context.fillStyle = 'rgba(245, 158, 11, 0.12)';
        context.strokeStyle = 'rgba(245, 158, 11, 0.18)';
        context.fillRect(frame.x, frame.y, frame.w, frame.h);
        context.strokeRect(frame.x, frame.y, frame.w, frame.h);
    }

    for (let index = 0; index < options.lines.vertical.length; index += 1) {
        const x = options.lines.vertical[index];
        context.strokeStyle = options.selectedHandle?.axis === 'vertical' && options.selectedHandle.index === index
            ? 'rgba(249, 115, 22, 0.95)'
            : 'rgba(251, 191, 36, 0.95)';
        context.beginPath();
        context.moveTo(x + lineWidth * 0.5, 0);
        context.lineTo(x + lineWidth * 0.5, options.imageHeight);
        context.stroke();
    }

    for (let index = 0; index < options.lines.horizontal.length; index += 1) {
        const y = options.lines.horizontal[index];
        context.strokeStyle = options.selectedHandle?.axis === 'horizontal' && options.selectedHandle.index === index
            ? 'rgba(249, 115, 22, 0.95)'
            : 'rgba(251, 191, 36, 0.95)';
        context.beginPath();
        context.moveTo(0, y + lineWidth * 0.5);
        context.lineTo(options.imageWidth, y + lineWidth * 0.5);
        context.stroke();
    }

    context.restore();
}

function drawFrameOverlay(
    context: CanvasRenderingContext2D,
    name: string,
    frame: SpriteFrame,
    options: { isHovered: boolean; isSelected: boolean; uiScale: number; zoom: number },
): void {
    const lineWidth = 1 / options.zoom;
    const fillColor = options.isSelected ? 'rgba(79, 70, 229, 0.25)' : (options.isHovered ? 'rgba(59, 130, 246, 0.18)' : 'rgba(255, 255, 255, 0.06)');
    const strokeColor = options.isSelected ? t.accent.primary : (options.isHovered ? t.accent.blue : 'rgba(255, 255, 255, 0.35)');

    context.fillStyle = fillColor;
    context.strokeStyle = strokeColor;
    context.lineWidth = lineWidth;
    context.fillRect(frame.x, frame.y, frame.w, frame.h);
    context.strokeRect(frame.x, frame.y, frame.w, frame.h);

    const fontSize = Math.max(10 / options.zoom, 9 * (options.uiScale / options.zoom));
    context.font = `${fontSize}px sans-serif`;
    context.textBaseline = 'top';

    const textWidth = context.measureText(name).width;
    const labelX = frame.x + 2 / options.zoom;
    const labelY = frame.y + 2 / options.zoom;
    const labelHeight = fontSize + 4 / options.zoom;
    const labelWidth = textWidth + 6 / options.zoom;
    context.fillStyle = 'rgba(15, 23, 42, 0.75)';
    context.fillRect(labelX, labelY, Math.min(labelWidth, frame.w), Math.min(labelHeight, frame.h));
    context.fillStyle = '#f8fafc';
    context.fillText(name, labelX + 3 / options.zoom, labelY + 2 / options.zoom, Math.max(0, frame.w - 6 / options.zoom));
}


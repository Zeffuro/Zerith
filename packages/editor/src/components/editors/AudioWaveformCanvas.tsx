import { type MouseEvent, type PointerEvent, useEffect, useRef, type WheelEvent } from 'react';

import { buildWaveformBars, timeToWaveformX } from './audiosheetEditorModel';

export type ActiveWaveformHandle = {
    cueName: string;
    handle: 'end' | 'start';
};

export type WaveformCueMarker = {
    end: number;
    name: string;
    start: number;
};

type AudioWaveformCanvasProperties = {
    activeHandle?: ActiveWaveformHandle;
    cues: WaveformCueMarker[];
    durationSeconds: number;
    height?: number;
    onClick?: (event: MouseEvent<HTMLCanvasElement>) => void;
    onContextMenu?: (event: MouseEvent<HTMLCanvasElement>) => void;
    onPointerCancel?: (event: PointerEvent<HTMLCanvasElement>) => void;
    onPointerDown?: (event: PointerEvent<HTMLCanvasElement>) => void;
    onPointerMove?: (event: PointerEvent<HTMLCanvasElement>) => void;
    onPointerUp?: (event: PointerEvent<HTMLCanvasElement>) => void;
    onWheel?: (event: WheelEvent<HTMLCanvasElement>) => void;
    peaks: number[];
    scrubSeconds: number;
    selectedCue: string | undefined;
    selectionAnchor: number | undefined;
};

export function AudioWaveformCanvas({
    activeHandle,
    cues,
    durationSeconds,
    height = 180,
    onClick,
    onContextMenu,
    onPointerCancel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel,
    peaks,
    scrubSeconds,
    selectedCue,
    selectionAnchor,
}: AudioWaveformCanvasProperties) {
    const canvasReference = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        drawWaveform(canvasReference.current, {
            activeHandle,
            cues,
            durationSeconds,
            peaks,
            scrubSeconds,
            selectedCue,
            selectionAnchor,
        });
    }, [activeHandle, cues, durationSeconds, peaks, scrubSeconds, selectedCue, selectionAnchor]);

    return (
        <canvas
            onClick={onClick}
            onContextMenu={onContextMenu}
            onPointerCancel={onPointerCancel ?? onPointerUp}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onWheel={onWheel}
            ref={canvasReference}
            style={{ cursor: onClick || onPointerDown ? 'pointer' : 'default', display: 'block', height, touchAction: 'none', width: '100%' }}
        />
    );
}

function drawHandle(context: CanvasRenderingContext2D, x: number, height: number, color: string): void {
    context.fillStyle = color;
    context.fillRect(x - 3, 4, 6, 8);
    context.fillRect(x - 3, height - 12, 6, 8);
}

function drawWaveform(canvas: HTMLCanvasElement | null, state: {
    activeHandle?: ActiveWaveformHandle;
    cues: WaveformCueMarker[];
    durationSeconds: number;
    peaks: number[];
    scrubSeconds: number;
    selectedCue: string | undefined;
    selectionAnchor: number | undefined;
}): void {
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const dpr = globalThis.devicePixelRatio || 1;
    const width = Math.max(320, Math.floor(canvas.clientWidth));
    const height = Math.max(100, Math.floor(canvas.clientHeight));
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#11131a';
    context.fillRect(0, 0, width, height);

    context.fillStyle = '#6599f5';
    for (const bar of buildWaveformBars(state.peaks, width, height)) {
        context.fillRect(bar.x, bar.y, bar.width, bar.height);
    }

    const toX = (seconds: number) => timeToWaveformX(seconds, state.durationSeconds, width);
    context.font = '12px sans-serif';
    for (const cue of state.cues) {
        const startX = toX(cue.start);
        const endX = toX(cue.end);
        const selected = cue.name === state.selectedCue;

        context.fillStyle = selected ? 'rgba(250, 204, 21, 0.12)' : 'rgba(16, 185, 129, 0.12)';
        context.fillRect(Math.min(startX, endX), 0, Math.max(2, Math.abs(endX - startX)), height);

        context.strokeStyle = selected ? '#facc15' : '#22c55e';
        context.lineWidth = selected ? 2 : 1;
        context.beginPath();
        context.moveTo(startX, 0);
        context.lineTo(startX, height);
        context.moveTo(endX, 0);
        context.lineTo(endX, height);
        context.stroke();

        const startActive = state.activeHandle?.cueName === cue.name && state.activeHandle.handle === 'start';
        const endActive = state.activeHandle?.cueName === cue.name && state.activeHandle.handle === 'end';
        drawHandle(context, startX, height, startActive ? '#f472b6' : '#86efac');
        drawHandle(context, endX, height, endActive ? '#f472b6' : '#93c5fd');

        context.fillStyle = '#d2f4da';
        context.fillText(cue.name, Math.min(width - 70, startX + 4), 14);
    }

    if (state.selectionAnchor !== undefined) {
        const x = toX(state.selectionAnchor);
        context.strokeStyle = '#f59e0b';
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
    }

    const scrubX = toX(state.scrubSeconds);
    context.strokeStyle = '#fb7185';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(scrubX, 0);
    context.lineTo(scrubX, height);
    context.stroke();
}




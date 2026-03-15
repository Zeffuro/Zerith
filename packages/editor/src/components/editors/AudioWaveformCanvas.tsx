import { type MouseEvent, useEffect, useRef } from 'react';

import { buildWaveformBars, timeToWaveformX } from './audiosheetEditorModel';

export type WaveformCueMarker = {
    name: string;
    start: number;
};

type AudioWaveformCanvasProperties = {
    cues: WaveformCueMarker[];
    durationSeconds: number;
    onClick: (event: MouseEvent<HTMLCanvasElement>) => void;
    peaks: number[];
    scrubSeconds: number;
    selectedCue: string | undefined;
    selectionAnchor: number | undefined;
};

export function AudioWaveformCanvas({
    cues,
    durationSeconds,
    onClick,
    peaks,
    scrubSeconds,
    selectedCue,
    selectionAnchor,
}: AudioWaveformCanvasProperties) {
    const canvasReference = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        drawWaveform(canvasReference.current, {
            cues,
            durationSeconds,
            peaks,
            scrubSeconds,
            selectedCue,
            selectionAnchor,
        });
    }, [cues, durationSeconds, peaks, scrubSeconds, selectedCue, selectionAnchor]);

    return <canvas onClick={onClick} ref={canvasReference} style={{ cursor: 'pointer', display: 'block', height: 180, width: '100%' }} />;
}

export function computeWaveformPeaks(channelData: Float32Array, bins: number): number[] {
    if (channelData.length === 0 || bins <= 0) return [];
    const samplesPerBin = Math.max(1, Math.floor(channelData.length / bins));
    const peaks = Array.from({ length: bins }, (_, index) => {
        const start = index * samplesPerBin;
        const end = index === bins - 1 ? channelData.length : start + samplesPerBin;
        let max = 0;
        for (let pointer = start; pointer < end; pointer += 1) max = Math.max(max, Math.abs(channelData[pointer] ?? 0));
        return max;
    });
    const maxPeak = Math.max(...peaks, 0.0001);
    return peaks.map((peak) => peak / maxPeak);
}

function drawWaveform(canvas: HTMLCanvasElement | null, state: {
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
        const x = toX(cue.start);
        context.strokeStyle = cue.name === state.selectedCue ? '#facc15' : '#22c55e';
        context.lineWidth = cue.name === state.selectedCue ? 2 : 1;
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
        context.fillStyle = '#d2f4da';
        context.fillText(cue.name, Math.min(width - 70, x + 4), 14);
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



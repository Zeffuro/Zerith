import { type AudiosheetDescriptor } from 'core';

export type AudiosheetCue = AudiosheetDescriptor['cues'][string];

export type CueOverlap = {
    overlapEnd: number;
    overlapStart: number;
    primary: string;
    secondary: string;
};

export type WaveformBar = {
    height: number;
    width: number;
    x: number;
    y: number;
};

export function buildWaveformBars(peaks: number[], width: number, height: number): WaveformBar[] {
    const safeWidth = Math.max(1, width);
    const safeHeight = Math.max(1, height);
    const centerY = safeHeight / 2;
    const barWidth = safeWidth / Math.max(peaks.length, 1);

    return peaks.map((peak, index) => {
        const normalizedPeak = clamp(Math.abs(peak), 0, 1);
        const amplitude = normalizedPeak * (safeHeight * 0.42);
        return {
            height: amplitude * 2,
            width: Math.max(1, barWidth - 0.5),
            x: index * barWidth,
            y: centerY - amplitude,
        };
    });
}

export function cueAtTime(cues: Record<string, AudiosheetCue>, timeSeconds: number): string | undefined {
    if (!Number.isFinite(timeSeconds) || timeSeconds < 0) return undefined;

    const entries = Object.entries(cues).toSorted((a, b) => a[1].start - b[1].start);
    for (const [name, cue] of entries) {
        const start = Math.max(0, cue.start);
        const end = cue.duration === undefined ? start : start + Math.max(0, cue.duration);
        if (timeSeconds >= start && timeSeconds < end) return name;
    }

    return undefined;
}

export function formatTimestamp(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00.000';

    const minutes = Math.floor(seconds / 60);
    const wholeSeconds = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);

    return `${String(minutes).padStart(2, '0')}:${String(wholeSeconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}

export function timeToWaveformX(seconds: number, durationSeconds: number, width: number): number {
    return clamp((seconds / Math.max(durationSeconds, 0.0001)) * Math.max(1, width), 0, Math.max(1, width));
}

export function validateCueOverlaps(cues: Record<string, AudiosheetCue>): CueOverlap[] {
    const entries = Object.entries(cues)
        .map(([name, cue]) => ({
            end: cue.start + Math.max(0, cue.duration ?? 0),
            name,
            start: cue.start,
        }))
        .filter((cue) => cue.end > cue.start)
        .toSorted((a, b) => a.start - b.start);

    const overlaps: CueOverlap[] = [];
    for (let index = 0; index < entries.length; index += 1) {
        const current = entries[index];
        for (let pointer = index + 1; pointer < entries.length; pointer += 1) {
            const candidate = entries[pointer];
            if (candidate.start >= current.end) break;
            overlaps.push({
                overlapEnd: Math.min(current.end, candidate.end),
                overlapStart: Math.max(current.start, candidate.start),
                primary: current.name,
                secondary: candidate.name,
            });
        }
    }

    return overlaps;
}


function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}


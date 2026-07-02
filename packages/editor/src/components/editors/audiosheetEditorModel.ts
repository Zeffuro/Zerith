import { type AudiosheetDescriptor } from '@zeffuro/zerith-core';

import { clamp } from '../../utils/math';

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

export type WaveformCueHandle = 'end' | 'start';

export type WaveformCueHandleHit = {
    cueName: string;
    handle: WaveformCueHandle;
};

export type WaveformCueRange = {
    end: number;
    name: string;
    start: number;
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

export function computeCueDragUpdate(
    cue: AudiosheetCue,
    handle: WaveformCueHandle,
    pointerSeconds: number,
    clipDuration?: number,
): Partial<AudiosheetCue> {
    const minDuration = 0.01;
    const safeStart = Math.max(0, cue.start);
    const maxTime = clipDuration === undefined ? Number.POSITIVE_INFINITY : Math.max(0, clipDuration);

    if (handle === 'start') {
        if (cue.duration === undefined) {
            return { start: clamp(pointerSeconds, 0, maxTime) };
        }

        const cueEnd = clamp(safeStart + Math.max(minDuration, cue.duration), 0, maxTime);
        const nextStart = clamp(pointerSeconds, 0, cueEnd - minDuration);
        return {
            duration: Math.max(minDuration, cueEnd - nextStart),
            start: nextStart,
        };
    }

    const nextEnd = clamp(pointerSeconds, safeStart + minDuration, maxTime);
    return { duration: Math.max(minDuration, nextEnd - safeStart) };
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

export function findCueHandleHit(
    cues: WaveformCueRange[],
    pointerX: number,
    durationSeconds: number,
    width: number,
    tolerancePx: number,
): undefined | WaveformCueHandleHit {
    if (cues.length === 0 || durationSeconds <= 0 || width <= 0) return undefined;

    let best: { distance: number; hit: WaveformCueHandleHit } | undefined;
    for (const cue of cues) {
        const startDistance = Math.abs(pointerX - timeToWaveformX(cue.start, durationSeconds, width));
        if (startDistance <= tolerancePx && (!best || startDistance < best.distance)) {
            best = { distance: startDistance, hit: { cueName: cue.name, handle: 'start' } };
        }

        const endDistance = Math.abs(pointerX - timeToWaveformX(cue.end, durationSeconds, width));
        if (endDistance <= tolerancePx && (!best || endDistance < best.distance)) {
            best = { distance: endDistance, hit: { cueName: cue.name, handle: 'end' } };
        }
    }

    return best?.hit;
}

export function findNearestCueBoundary(
    cues: WaveformCueRange[],
    timeSeconds: number,
    side: 'left' | 'right',
): { cueName: string; handle: WaveformCueHandle; time: number } | undefined {
    let best: { cueName: string; handle: WaveformCueHandle; time: number } | undefined;

    for (const cue of cues) {
        const candidates: readonly [WaveformCueHandle, number][] = [
            ['start', cue.start],
            ['end', cue.end],
        ];

        for (const [handle, markerTime] of candidates) {
            if (side === 'left' && markerTime > timeSeconds) continue;
            if (side === 'right' && markerTime < timeSeconds) continue;

            if (!best) {
                best = { cueName: cue.name, handle, time: markerTime };
                continue;
            }

            if (side === 'left' && markerTime > best.time) {
                best = { cueName: cue.name, handle, time: markerTime };
            }
            if (side === 'right' && markerTime < best.time) {
                best = { cueName: cue.name, handle, time: markerTime };
            }
            if (side === 'left' && markerTime === best.time && handle === 'end' && best.handle !== 'end') {
                best = { cueName: cue.name, handle, time: markerTime };
            }
            if (side === 'right' && markerTime === best.time && handle === 'start' && best.handle !== 'start') {
                best = { cueName: cue.name, handle, time: markerTime };
            }
        }
    }

    return best;
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

export function waveformXToTime(x: number, durationSeconds: number, width: number): number {
    const safeWidth = Math.max(1, width);
    const ratio = clamp(x / safeWidth, 0, 1);
    return ratio * Math.max(0, durationSeconds);
}

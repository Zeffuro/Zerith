import { describe, expect, it } from 'vitest';

import {
    buildWaveformBars,
    cueAtTime,
    formatTimestamp,
    timeToWaveformX,
    validateCueOverlaps,
} from '../audiosheetEditorModel';

describe('audiosheetEditorModel', () => {
    it('formats timestamps as mm:ss.mmm', () => {
        expect(formatTimestamp(0)).toBe('00:00.000');
        expect(formatTimestamp(65.4321)).toBe('01:05.432');
        expect(formatTimestamp(Number.NaN)).toBe('00:00.000');
    });

    it('returns cue at time using half-open ranges', () => {
        const cues = {
            intro: { start: 0, volume: 1 },
            loop: { duration: 1.5, start: 2, volume: 1 },
        };

        expect(cueAtTime(cues, 1)).toBeUndefined();
        expect(cueAtTime(cues, 2)).toBe('loop');
        expect(cueAtTime(cues, 3.49)).toBe('loop');
        expect(cueAtTime(cues, 3.5)).toBeUndefined();
    });

    it('reports overlapping cue ranges', () => {
        const overlaps = validateCueOverlaps({
            a: { duration: 1, start: 0, volume: 1 },
            b: { duration: 1, start: 0.5, volume: 1 },
            c: { duration: 1, start: 2, volume: 1 },
        });

        expect(overlaps).toEqual([
            {
                overlapEnd: 1,
                overlapStart: 0.5,
                primary: 'a',
                secondary: 'b',
            },
        ]);
    });

    it('builds deterministic waveform bars from peaks', () => {
        const bars = buildWaveformBars([0, 0.5, 1], 120, 100);

        expect(bars).toEqual([
            { height: 0, width: 39.5, x: 0, y: 50 },
            { height: 42, width: 39.5, x: 40, y: 29 },
            { height: 84, width: 39.5, x: 80, y: 8 },
        ]);
    });

    it('maps time to canvas x with clamping', () => {
        expect(timeToWaveformX(2, 4, 200)).toBe(100);
        expect(timeToWaveformX(-1, 4, 200)).toBe(0);
        expect(timeToWaveformX(9, 4, 200)).toBe(200);
    });
});


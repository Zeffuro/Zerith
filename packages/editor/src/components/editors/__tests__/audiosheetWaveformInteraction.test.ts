import { describe, expect, it } from 'vitest';

import { panWaveformViewportByPixels } from '../audiosheetWaveformInteraction';

describe('audiosheetWaveformInteraction', () => {
    it('pans waveform viewport from shift-wheel pixel deltas', () => {
        expect(panWaveformViewportByPixels(100, 200, 4, 2, 12)).toBe(4);
        expect(panWaveformViewportByPixels(-100, 200, 4, 2, 12)).toBe(0);
    });

    it('clamps waveform panning to the visible audio range', () => {
        expect(panWaveformViewportByPixels(1000, 200, 4, 8, 12)).toBe(8);
        expect(panWaveformViewportByPixels(-1000, 200, 4, 1, 12)).toBe(0);
        expect(panWaveformViewportByPixels(100, 0, 4, 2, 12)).toBe(8);
    });
});

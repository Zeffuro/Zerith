import { describe, expect, it } from 'vitest';

import { buildCommandPaletteIsRunning } from '../commandPaletteRunningStateAdapterModel';

describe('commandPaletteRunningStateAdapterModel', () => {
    it('returns true when playTrigger is greater than stopTrigger', () => {
        expect(buildCommandPaletteIsRunning({ playTrigger: 7, stopTrigger: 6 })).toBe(true);
    });

    it('returns false when playTrigger is equal to stopTrigger', () => {
        expect(buildCommandPaletteIsRunning({ playTrigger: 6, stopTrigger: 6 })).toBe(false);
    });

    it('returns false when playTrigger is lower than stopTrigger', () => {
        expect(buildCommandPaletteIsRunning({ playTrigger: 4, stopTrigger: 6 })).toBe(false);
    });
});


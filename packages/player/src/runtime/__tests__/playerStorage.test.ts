import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPlayerStorage } from '../playerStorage';

describe('per-game player storage', () => {
    afterEach(() => vi.unstubAllGlobals());
    it('isolates games by stable id and preserves the old unscoped data', () => {
        const entries = new Map([['zerith_save_1', 'old save']]);
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => entries.get(key),
            removeItem: (key: string) => entries.delete(key),
            setItem: (key: string, value: string) => entries.set(key, value),
        });
        const first = createPlayerStorage({ id: 'station', title: 'Late Train' })!;
        const second = createPlayerStorage({ id: 'inn', title: 'Late Train' })!;
        first.setItem('zerith_save_1', 'station save');
        second.setItem('player_preferences', 'inn settings');
        expect(second.getItem('zerith_save_1')).toBeUndefined();
        expect(first.getItem('player_preferences')).toBeUndefined();
        expect(createPlayerStorage({ id: 'station', title: 'Last Train' })?.getItem('zerith_save_1')).toBe('station save');
        first.removeItem('zerith_save_1');
        expect(entries.get('zerith_save_1')).toBe('old save');
        expect(second.getItem('player_preferences')).toBe('inn settings');
    });
    it('uses the explicit provider unchanged for custom save storage', () => {
        const configured = { getItem: () => 'saved', removeItem: () => {}, setItem: () => {} };
        expect(createPlayerStorage({ title: 'Late Train' }, configured)).toBe(configured);
    });
    it('keeps playable session storage when the browser denies storage access', () => {
        vi.stubGlobal('localStorage', Reflect.get({}, 'localStorage'));
        const storage = createPlayerStorage({ title: 'Late Train' })!;
        storage.setItem('zerith_save_1', 'saved');
        expect(storage.getItem('zerith_save_1')).toBe('saved');
    });
});


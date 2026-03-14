import { describe, expect, it } from 'vitest';

import {
    normalizeShortcutChord,
    parseShortcutChord,
    serializeShortcutChord,
    shortcutChordFromEvent,
} from '../shortcutChord';

describe('shortcutChord', () => {
    it('normalizes textual chords into canonical form', () => {
        expect(normalizeShortcutChord('Ctrl + Shift + K')).toBe('mod+shift+k');
        expect(normalizeShortcutChord('Alt+F')).toBe('alt+f');
        expect(normalizeShortcutChord('')).toBeUndefined();
    });

    it('parses and serializes chords consistently', () => {
        const parsed = parseShortcutChord('cmd+alt+z');
        expect(parsed).toEqual({ key: 'z', requireAlt: true, requireMod: true, requireShift: false });

        if (!parsed) throw new TypeError('Expected parsed chord.');
        expect(serializeShortcutChord(parsed)).toBe('mod+alt+z');
    });

    it('builds chords from keyboard events', () => {
        const chord = shortcutChordFromEvent({
            altKey: false,
            ctrlKey: true,
            key: 'K',
            metaKey: false,
            shiftKey: true,
        });

        expect(chord).toEqual({ key: 'k', requireAlt: false, requireMod: true, requireShift: true });
    });
});

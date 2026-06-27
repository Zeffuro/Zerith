import { describe, expect, it } from 'vitest';

import { formatSaveSlotText } from '../SaveLoadPanel';

describe('SaveLoadPanel', () => {
    it('formats save slots with preview and version metadata', () => {
        const text = formatSaveSlotText(2, {
            contentSchemaVersion: 2,
            previewSpeaker: 'Aria',
            previewText: 'Welcome back.',
            savedAt: Date.UTC(2026, 0, 2, 3, 4, 5),
            saveSchemaVersion: 1,
            sceneName: 'intro',
            slot: 2,
        }, {
            primaryMaxLength: 80,
            secondaryMaxLength: 120,
        });

        expect(text.primary).toBe('Slot 2 - intro');
        expect(text.secondary).toBe('Aria: Welcome back.');
        expect(text.tertiary).toContain('Save v1 / Content v2');
    });

    it('formats empty slots without version metadata', () => {
        expect(formatSaveSlotText(1, undefined, {
            primaryMaxLength: 80,
            secondaryMaxLength: 120,
        })).toEqual({
            primary: 'Slot 1 - Empty',
            secondary: 'No save data',
            tertiary: '',
        });
    });

    it('formats bookmark and chapter context in occupied slots', () => {
        const text = formatSaveSlotText(4, {
            bookmarkId: 'chapter-one-start',
            chapter: 'Chapter One',
            kind: 'bookmark',
            savedAt: Date.UTC(2026, 0, 2, 3, 4, 5),
            sceneName: 'intro',
            slot: 4,
        }, {
            primaryMaxLength: 80,
            secondaryMaxLength: 120,
        });

        expect(text.primary).toBe('Slot 4 - Chapter One');
        expect(text.tertiary).toContain('Bookmark chapter-one-start');
    });
});

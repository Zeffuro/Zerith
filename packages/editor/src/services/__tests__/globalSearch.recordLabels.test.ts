import { describe, expect, it } from 'vitest';

import {
    CHARACTER_LABEL_PREFIX,
    formatRecordLabel,
    formatRecordSourceLabel,
    ITEM_LABEL_PREFIX,
    resolveRecordLabelPrefix,
} from '../globalSearch/recordLabels';

describe('globalSearch record label helpers', () => {
    it('exposes stable label prefixes for character and item sources', () => {
        expect(CHARACTER_LABEL_PREFIX).toBe('Character');
        expect(ITEM_LABEL_PREFIX).toBe('Item');
    });

    it('formats record labels with the shared prefix-entry pattern', () => {
        expect(formatRecordLabel(CHARACTER_LABEL_PREFIX, 'hero')).toBe('Character: hero');
        expect(formatRecordLabel(ITEM_LABEL_PREFIX, 'badge')).toBe('Item: badge');
    });

    it('resolves record label prefix from record kind', () => {
        expect(resolveRecordLabelPrefix('character')).toBe(CHARACTER_LABEL_PREFIX);
        expect(resolveRecordLabelPrefix('item')).toBe(ITEM_LABEL_PREFIX);
    });

    it('formats record labels directly from record kind', () => {
        expect(formatRecordSourceLabel('character', 'hero')).toBe('Character: hero');
        expect(formatRecordSourceLabel('item', 'badge')).toBe('Item: badge');
    });
});


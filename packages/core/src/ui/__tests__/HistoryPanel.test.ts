import { describe, expect, it } from 'vitest';

import {
    cleanHistoryPanelText,
    formatHistoryPanelEntry,
    formatHistoryPanelTimestamp,
    HistoryPanel,
} from '../HistoryPanel';

describe('HistoryPanel helpers', () => {
    it('uses backlog wording while preserving the stable panel id', () => {
        const panel = new HistoryPanel({ getRecent: () => [] });

        expect(panel.id).toBe('history');
        expect(panel.label).toBe('Backlog');
    });

    it('formats persisted dialogue history for player backlog rows', () => {
        const timestamp = new Date(2026, 0, 2, 9, 5).getTime();

        expect(formatHistoryPanelEntry({
            speaker: '  ',
            text: 'Hello <b>there</b>{wait:100}\nagain.',
            timestamp,
        })).toEqual({
            speaker: 'Narrator',
            text: 'Hello there again.',
            timestamp: '09:05',
        });
    });

    it('cleans runtime text markup and tolerates invalid timestamps', () => {
        expect(cleanHistoryPanelText('Line {speed:0}<i>one</i>.')).toBe('Line one.');
        expect(formatHistoryPanelTimestamp(Number.NaN)).toBe('');
    });
});

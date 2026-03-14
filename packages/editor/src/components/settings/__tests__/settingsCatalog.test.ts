import { describe, expect, it } from 'vitest';

import { buildSettingsLeafCountMap, buildSettingsNodeCountMap, filterSettingsTree, settingsCatalog } from '../settingsCatalog';

describe('filterSettingsTree', () => {
    it('returns full catalog for blank search', () => {
        const result = filterSettingsTree(settingsCatalog, '   ');

        expect(result).toHaveLength(settingsCatalog.length);
        expect(result).toEqual(settingsCatalog);
        expect(result).not.toBe(settingsCatalog);
    });

    it('keeps only matching branches when a child label matches', () => {
        const result = filterSettingsTree(settingsCatalog, 'autosave');

        expect(result).toEqual([
            {
                children: [{ id: 'general-autosave', label: 'Autosave' }],
                id: 'general',
                label: 'General',
            },
        ]);
    });

    it('matches top-level labels case-insensitively', () => {
        const result = filterSettingsTree(settingsCatalog, 'KEYMAP');

        expect(result).toEqual([{ id: 'keymap', label: 'Keymap' }]);
    });

    it('returns no nodes when nothing matches', () => {
        const result = filterSettingsTree(settingsCatalog, 'nope');

        expect(result).toEqual([]);
    });

    it('builds leaf-count map for filtered trees', () => {
        const filtered = filterSettingsTree(settingsCatalog, 'appearance');
        const counts = buildSettingsLeafCountMap(filtered);

        expect(counts).toEqual({
            appearance: 1,
        });
    });

    it('aggregates node counts from leaf count inputs', () => {
        const counts = buildSettingsNodeCountMap(settingsCatalog, {
            'appearance-scale': 2,
            'appearance-theme': 1,
            keymap: 3,
        });

        expect(counts).toEqual({
            appearance: 3,
            'appearance-scale': 2,
            'appearance-theme': 1,
            editor: 0,
            'editor-behavior': 0,
            'editor-monaco': 0,
            general: 0,
            'general-autosave': 0,
            'general-playback': 0,
            keymap: 3,
        });
    });
});


import { describe, expect, it } from 'vitest';

import { filterSettingsTree, settingsCatalog } from '../settingsCatalog';

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
});


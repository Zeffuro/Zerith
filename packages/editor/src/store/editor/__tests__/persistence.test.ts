import { describe, expect, it } from 'vitest';

import { extractPersistedEditorState } from '../persistence';
import { settingsBackedUiPrefsKeys } from '../settingsBackedUiPrefsKeys';

describe('extractPersistedEditorState', () => {
    it('returns an empty object for non-record inputs', () => {
        expect(extractPersistedEditorState(1)).toEqual({});
        expect(extractPersistedEditorState(['bad', 'input'])).toEqual({});
    });

    it('keeps editor-owned persisted keys only', () => {
        const value = {
            breakpoints: { '/scripts/intro.json': [1, 3] },
            recentProjects: [{ lastOpened: 7, name: 'A', path: '/a' }],
        };

        const output = extractPersistedEditorState(value);

        expect(output.breakpoints).toEqual({ '/scripts/intro.json': [1, 3] });
        expect(output).not.toHaveProperty('recentProjects');
        expect(output).not.toHaveProperty('windowState');
    });

    it('drops invalid sanitized fields while keeping supported persisted keys', () => {
        const value = {
            autosaveEnabled: true,
            autosaveIntervalMs: 15_000,
            isMuted: true,
            recentProjects: 'invalid',
            themeKey: 'dark',
            uiScale: 1.25,
            unknownKey: 'ignore-me',
            windowState: { height: 200, width: 300, x: 0, y: 0 },
        };

        const output = extractPersistedEditorState(value);

        expect(output).toEqual({});
        for (const key of settingsBackedUiPrefsKeys) {
            expect(output).not.toHaveProperty(key);
        }
        expect(output).not.toHaveProperty('unknownKey');
    });
});


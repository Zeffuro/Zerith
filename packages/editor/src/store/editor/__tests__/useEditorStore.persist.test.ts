import { describe, expect, it } from 'vitest';

import type { EditorState } from '../types';

import { persistedEditorStateKeys } from '../persistence';
import { partializeEditorStateForPersistence } from '../persistShape';
import { isSettingsBackedUiPrefKey, settingsBackedUiPrefsKeys } from '../settingsBackedUiPrefsKeys';

describe('partializeEditorStateForPersistence', () => {
    it('keeps editor-specific persisted keys and excludes settings-backed prefs', () => {
        const state = {
            autosaveEnabled: true,
            autosaveIntervalMs: 15_000,
            breakpoints: { '/script.json': [1, 3] },
            dockLayoutJson: { value: 1 },
            dockLayoutVersion: 2,
            isMuted: true,
            quickCommandTypes: ['wait'],
            recentProjects: [{ lastOpened: 1, name: 'Game', path: '/game.json' }],
            themeKey: 'classicSoft',
            uiScale: 1.5,
            windowState: { height: 700, maximized: false, width: 1200, x: 10, y: 20 },
        } as unknown as EditorState;

        const output = partializeEditorStateForPersistence(state);

        expect(output).toEqual({
            breakpoints: { '/script.json': [1, 3] },
            dockLayoutJson: { value: 1 },
            dockLayoutVersion: 2,
            quickCommandTypes: ['wait'],
        });

        for (const key of settingsBackedUiPrefsKeys) {
            expect(output).not.toHaveProperty(key);
        }

        for (const key of Object.keys(output)) {
            expect(isSettingsBackedUiPrefKey(key)).toBe(false);
        }

        expect(Object.keys(output).toSorted()).toEqual([...persistedEditorStateKeys].toSorted());
    });
});


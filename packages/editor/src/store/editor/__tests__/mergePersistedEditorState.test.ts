import { describe, expect, it } from 'vitest';

import type { EditorState } from '../types';

import { mergePersistedEditorState } from '../mergePersistedEditorState';
import { settingsBackedUiPrefsKeys } from '../settingsBackedUiPrefsKeys';

describe('mergePersistedEditorState', () => {
    it('applies editor-owned persisted keys and ignores settings-backed keys', () => {
        const current = {
            autosaveEnabled: true,
            autosaveIntervalMs: 10_000,
            breakpoints: { '/current.json': [1] },
            dockLayoutJson: { global: { splitterSize: 4 }, layout: { type: 'row' } },
            dockLayoutVersion: 4,
            isMuted: false,
            recentProjects: [{ lastOpened: 9, name: 'Current', path: '/current/game.json' }],
            themeKey: 'classicSoft',
            uiScale: 1.25,
            windowState: { height: 700, maximized: true, width: 1200, x: 10, y: 20 },
        } as unknown as EditorState;

        const persisted = {
            autosaveEnabled: false,
            autosaveIntervalMs: 30_000,
            breakpoints: { '/persisted.json': [2, 4] },
            dockLayoutJson: { global: { splitterSize: 6 }, layout: { type: 'row' } },
            dockLayoutVersion: 4,
            isMuted: true,
            recentProjects: [{ lastOpened: 1, name: 'Old', path: '/old/game.json' }],
            themeKey: 'classic',
            uiScale: 2,
            windowState: { height: 800, maximized: false, width: 1400, x: 30, y: 40 },
        };

        const normalizedMerged = mergePersistedEditorState(current, persisted, (state: unknown) => {
            const record = (state && typeof state === 'object') ? state as Record<string, unknown> : {};
            return {
                dockLayoutJson: record.dockLayoutJson ?? { global: {}, layout: {} },
                dockLayoutVersion: typeof record.dockLayoutVersion === 'number' ? record.dockLayoutVersion : 4,
            };
        });

        expect(normalizedMerged.breakpoints).toEqual({ '/persisted.json': [2, 4] });
        expect(normalizedMerged.dockLayoutVersion).toBe(4);
        expect(normalizedMerged.dockLayoutJson).toEqual({ global: { splitterSize: 6 }, layout: { type: 'row' } });

        for (const key of settingsBackedUiPrefsKeys) {
            expect(normalizedMerged[key]).toEqual(current[key]);
        }
    });
});


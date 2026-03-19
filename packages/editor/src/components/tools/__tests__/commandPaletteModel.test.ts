import { describe, expect, it, vi } from 'vitest';

import {
    clampRenderSelection,
    filterActions,
    nextSelectionIndex,
    openInitialProjectEntry,
    resolveInitialProjectEntryPath,
    resolveProjectPath,
    shouldShowEmptyActions,
    toRenderableActions,
} from '../commandPaletteModel';

describe('commandPaletteModel', () => {
    it('filters actions by normalized query with fuzzy matching', () => {
        const actions = [
            { id: 'save', keywords: 'write file', label: 'Save Active File' },
            { id: 'settings', keywords: 'preferences keymap', label: 'Open Settings' },
        ];

        expect(filterActions(actions, '  save ')).toEqual([actions[0]]);
        expect(filterActions(actions, 'KEYMAP')).toEqual([actions[1]]);
        expect(filterActions(actions, 'svaf')).toEqual([actions[0]]);
        expect(filterActions(actions, '   ')).toEqual(actions);
    });

    it('clamps next selection index at list bounds', () => {
        expect(nextSelectionIndex(0, 3, 1)).toBe(1);
        expect(nextSelectionIndex(2, 3, 1)).toBe(2);
        expect(nextSelectionIndex(0, 3, -1)).toBe(0);
        expect(nextSelectionIndex(2, 3, -1)).toBe(1);
        expect(nextSelectionIndex(0, 0, 1)).toBe(0);
    });

    it('resolves project paths for both rooted and relative targets', () => {
        expect(resolveProjectPath('/repo/game', 'scripts/intro.json')).toBe('/repo/game/scripts/intro.json');
        expect(resolveProjectPath('/repo/game', '/scripts/intro.json')).toBe('/repo/game/scripts/intro.json');
        expect(resolveProjectPath('C:/repo/game', String.raw`\scripts\intro.json`)).toBe(String.raw`C:/repo/game\scripts\intro.json`);
    });

    it('resolves initial project entry using start scene then falls back to game manifest', () => {
        const manifestWithStart = {
            scenes: {
                intro: 'scripts/intro.json',
            },
            startScene: 'intro',
        };
        const manifestWithoutStart = {
            scenes: {
                intro: 'scripts/intro.json',
            },
        };

        expect(resolveInitialProjectEntryPath('/repo/game', manifestWithStart)).toBe('/repo/game/scripts/intro.json');
        expect(resolveInitialProjectEntryPath('/repo/game', manifestWithoutStart)).toBe('/repo/game/game.json');
        expect(resolveInitialProjectEntryPath(undefined, manifestWithStart)).toBeUndefined();
    });

    it('maps actions into renderable rows with hint fallback', () => {
        const actions = [
            { action: () => {}, id: 'save', keywords: 'save', label: 'Save', shortcut: 'Ctrl+S' },
            { action: () => {}, id: 'play', keywords: 'play', label: 'Play' },
        ];

        const renderable = toRenderableActions(actions);

        expect(renderable).toEqual([
            { hintText: 'Ctrl+S', id: 'save', label: 'Save' },
            { hintText: '', id: 'play', label: 'Play' },
        ]);
    });

    it('clamps rendered selection to list bounds', () => {
        expect(clampRenderSelection(-1, 3)).toBe(0);
        expect(clampRenderSelection(1, 3)).toBe(1);
        expect(clampRenderSelection(7, 3)).toBe(2);
        expect(clampRenderSelection(3, 0)).toBe(0);
    });

    it('shows empty state only when there are no actions', () => {
        expect(shouldShowEmptyActions(0)).toBe(true);
        expect(shouldShowEmptyActions(2)).toBe(false);
    });

    it('opens and expands the resolved initial project entry path', async () => {
        const expandToPath = vi.fn();
        const openProjectEntry = vi.fn(() => Promise.resolve());
        const manifest = {
            scenes: {
                intro: 'scripts/intro.json',
            },
            startScene: 'intro',
        };

        await openInitialProjectEntry({
            expandToPath,
            manifest,
            openProjectEntry,
            projectPath: '/repo/game',
        });

        expect(expandToPath).toHaveBeenCalledWith('/repo/game/scripts/intro.json');
        expect(openProjectEntry).toHaveBeenCalledWith('/repo/game/scripts/intro.json', 'intro.json');
    });
});


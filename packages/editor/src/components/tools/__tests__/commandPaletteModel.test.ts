import { describe, expect, it } from 'vitest';

import {
    filterActions,
    nextSelectionIndex,
    resolveInitialProjectEntryPath,
    resolveProjectPath,
} from '../commandPaletteModel';

describe('commandPaletteModel', () => {
    it('filters actions by normalized query', () => {
        const actions = [
            { id: 'save', keywords: 'write file', label: 'Save Active File' },
            { id: 'settings', keywords: 'preferences keymap', label: 'Open Settings' },
        ];

        expect(filterActions(actions, '  save ')).toEqual([actions[0]]);
        expect(filterActions(actions, 'KEYMAP')).toEqual([actions[1]]);
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
});


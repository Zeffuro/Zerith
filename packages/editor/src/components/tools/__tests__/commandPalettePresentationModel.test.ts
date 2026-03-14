import { describe, expect, it } from 'vitest';

import { clampRenderSelection, shouldShowEmptyActions, toRenderableActions } from '../commandPalettePresentationModel';

describe('commandPalettePresentationModel', () => {
    it('maps actions into renderable rows with hint fallback', () => {
        const actions = [
            { execute: () => {}, hint: 'Ctrl+S', id: 'save', keywords: 'save', label: 'Save' },
            { execute: () => {}, id: 'play', keywords: 'play', label: 'Play' },
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
});


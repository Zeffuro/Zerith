import { describe, expect, it, vi } from 'vitest';

import {
    clampSelectionIndex,
    executeSelectedAction,
    reduceCommandPaletteKey,
    resolveExecuteIndex,
} from '../commandPaletteInteractionModel';

describe('commandPaletteInteractionModel', () => {
    it('clamps a selection index into range', () => {
        expect(clampSelectionIndex(-1, 3)).toBe(0);
        expect(clampSelectionIndex(4, 3)).toBe(2);
        expect(clampSelectionIndex(1, 3)).toBe(1);
        expect(clampSelectionIndex(5, 0)).toBe(0);
    });

    it('reduces arrow keys into select intents', () => {
        expect(reduceCommandPaletteKey('ArrowDown', { actionCount: 3, selectedIndex: 0 }))
            .toEqual({ kind: 'select', nextIndex: 1 });
        expect(reduceCommandPaletteKey('ArrowUp', { actionCount: 3, selectedIndex: 2 }))
            .toEqual({ kind: 'select', nextIndex: 1 });
    });

    it('wraps arrow-key selection around list edges', () => {
        expect(reduceCommandPaletteKey('ArrowDown', { actionCount: 3, selectedIndex: 2 }))
            .toEqual({ kind: 'select', nextIndex: 0 });
        expect(reduceCommandPaletteKey('ArrowUp', { actionCount: 3, selectedIndex: 0 }))
            .toEqual({ kind: 'select', nextIndex: 2 });
    });

    it('reduces enter and escape keys into execute and close intents', () => {
        expect(reduceCommandPaletteKey('Enter', { actionCount: 2, selectedIndex: 1 }))
            .toEqual({ index: 1, kind: 'execute' });
        expect(reduceCommandPaletteKey('Escape', { actionCount: 2, selectedIndex: 1 }))
            .toEqual({ kind: 'close' });
    });

    it('keeps enter execution index aligned with selected state for out-of-range selections', () => {
        expect(reduceCommandPaletteKey('Enter', { actionCount: 2, selectedIndex: 7 }))
            .toEqual({ index: 7, kind: 'execute' });
    });

    it('returns undefined for unsupported keys', () => {
        expect(reduceCommandPaletteKey('Tab', { actionCount: 2, selectedIndex: 1 })).toBeUndefined();
    });

    it('keeps execute index behavior aligned with the selected index', () => {
        expect(resolveExecuteIndex(5, 2)).toBe(5);
        expect(resolveExecuteIndex(0, 0)).toBe(0);
    });

    it('executes selected action and closes on success', async () => {
        const action = vi.fn(async () => {});
        const close = vi.fn();

        await executeSelectedAction([{ action }], 0, close);

        expect(action).toHaveBeenCalledTimes(1);
        expect(close).toHaveBeenCalledTimes(1);
    });

    it('does not execute or close for disabled actions', async () => {
        const action = vi.fn(async () => {});
        const close = vi.fn();

        await executeSelectedAction([{ action, disabledReason: 'Open a project first.' }], 0, close);

        expect(action).not.toHaveBeenCalled();
        expect(close).not.toHaveBeenCalled();
    });

    it('does nothing for an out-of-range action index', async () => {
        const close = vi.fn();

        await executeSelectedAction([], 0, close);

        expect(close).not.toHaveBeenCalled();
    });
});


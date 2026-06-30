import { describe, expect, it } from 'vitest';

import { resolveNextDialogFocusIndex } from '../useDialogFocusTrap';

describe('resolveNextDialogFocusIndex', () => {
    it('returns undefined when no focusable elements exist', () => {
        expect(resolveNextDialogFocusIndex({
            currentIndex: 0,
            direction: 'forward',
            focusableCount: 0,
        })).toBeUndefined();
    });

    it('starts at the first or last element when focus is outside the dialog', () => {
        expect(resolveNextDialogFocusIndex({
            currentIndex: -1,
            direction: 'forward',
            focusableCount: 3,
        })).toBe(0);
        expect(resolveNextDialogFocusIndex({
            currentIndex: -1,
            direction: 'backward',
            focusableCount: 3,
        })).toBe(2);
    });

    it('wraps forward and backward within the focusable element list', () => {
        expect(resolveNextDialogFocusIndex({
            currentIndex: 2,
            direction: 'forward',
            focusableCount: 3,
        })).toBe(0);
        expect(resolveNextDialogFocusIndex({
            currentIndex: 0,
            direction: 'backward',
            focusableCount: 3,
        })).toBe(2);
    });
});

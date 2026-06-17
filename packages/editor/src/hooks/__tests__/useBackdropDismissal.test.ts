import { describe, expect, it } from 'vitest';

import { shouldDismissBackdropClick } from '../useBackdropDismissal';

describe('shouldDismissBackdropClick', () => {
    it('dismisses only when the pointer and click both happen on the backdrop', () => {
        const backdrop = {} as EventTarget;
        const modal = {} as EventTarget;

        expect(shouldDismissBackdropClick({
            currentTarget: backdrop,
            pointerStartedOnBackdrop: true,
            target: backdrop,
        })).toBe(true);

        expect(shouldDismissBackdropClick({
            currentTarget: backdrop,
            pointerStartedOnBackdrop: false,
            target: backdrop,
        })).toBe(false);

        expect(shouldDismissBackdropClick({
            currentTarget: backdrop,
            pointerStartedOnBackdrop: true,
            target: modal,
        })).toBe(false);
    });

    it('does not dismiss while disabled', () => {
        const backdrop = {} as EventTarget;

        expect(shouldDismissBackdropClick({
            currentTarget: backdrop,
            disabled: true,
            pointerStartedOnBackdrop: true,
            target: backdrop,
        })).toBe(false);
    });
});

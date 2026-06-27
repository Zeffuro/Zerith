import { describe, expect, it } from 'vitest';

import { createGamePreviewAccessibilityAttributes } from '../gamePreviewAccessibility';

describe('gamePreviewAccessibility', () => {
    it('marks the preview container as the focusable application surface', () => {
        expect(createGamePreviewAccessibilityAttributes({
            isFocused: false,
            isStarted: false,
        })).toEqual({
            canvas: {
                'aria-hidden': true,
                role: 'presentation',
            },
            container: {
                'aria-label': 'Game preview',
                role: 'application',
                tabIndex: 0,
            },
        });
    });

    it('adds a polite focus hint only while playback is running outside preview focus', () => {
        expect(createGamePreviewAccessibilityAttributes({
            isFocused: false,
            isStarted: true,
        })).toMatchObject({
            container: {
                'aria-label': 'Game preview playback',
            },
            focusHint: {
                'aria-live': 'polite',
                role: 'status',
            },
        });

        expect(createGamePreviewAccessibilityAttributes({
            isFocused: true,
            isStarted: true,
        }).focusHint).toBeUndefined();
    });
});

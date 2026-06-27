export type GamePreviewAccessibilityAttributes = {
    canvas: {
        'aria-hidden': true;
        role: 'presentation';
    };
    container: {
        'aria-label': string;
        role: 'application';
        tabIndex: 0;
    };
    focusHint?: {
        'aria-live': 'polite';
        role: 'status';
    };
};

export type GamePreviewAccessibilityState = {
    isFocused: boolean;
    isStarted: boolean;
};

export function createGamePreviewAccessibilityAttributes(
    state: GamePreviewAccessibilityState,
): GamePreviewAccessibilityAttributes {
    return {
        canvas: {
            'aria-hidden': true,
            role: 'presentation',
        },
        container: {
            'aria-label': state.isStarted ? 'Game preview playback' : 'Game preview',
            role: 'application',
            tabIndex: 0,
        },
        ...(state.isStarted && !state.isFocused
            ? {
                focusHint: {
                    'aria-live': 'polite' as const,
                    role: 'status' as const,
                },
            }
            : {}),
    };
}

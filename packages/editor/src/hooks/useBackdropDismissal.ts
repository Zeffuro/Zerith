import {
    type MouseEvent as ReactMouseEvent,
    type PointerEvent as ReactPointerEvent,
    useCallback,
    useRef,
} from 'react';

export type BackdropClickState = {
    currentTarget: EventTarget | null;
    disabled?: boolean;
    pointerStartedOnBackdrop: boolean;
    target: EventTarget | null;
};

type BackdropDismissalOptions = {
    disabled?: boolean;
    shouldIgnore?: () => boolean;
};

export function shouldDismissBackdropClick({
    currentTarget,
    disabled = false,
    pointerStartedOnBackdrop,
    target,
}: BackdropClickState): boolean {
    return !disabled && pointerStartedOnBackdrop && currentTarget !== null && currentTarget === target;
}

export function useBackdropDismissal(
    onDismiss: () => void,
    options: BackdropDismissalOptions = {},
) {
    const pointerStartedOnBackdropReference = useRef(false);
    const { disabled = false, shouldIgnore } = options;

    const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        pointerStartedOnBackdropReference.current = event.currentTarget === event.target;
    }, []);

    const onClick = useCallback((event: ReactMouseEvent<HTMLElement>) => {
        const shouldDismiss = shouldDismissBackdropClick({
            currentTarget: event.currentTarget,
            disabled,
            pointerStartedOnBackdrop: pointerStartedOnBackdropReference.current,
            target: event.target,
        });

        pointerStartedOnBackdropReference.current = false;

        if (!shouldDismiss) return;
        if (shouldIgnore?.()) return;

        onDismiss();
    }, [disabled, onDismiss, shouldIgnore]);

    return {
        onClick,
        onPointerDown,
    };
}

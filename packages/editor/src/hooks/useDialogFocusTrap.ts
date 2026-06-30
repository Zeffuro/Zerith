import { type RefObject, useEffect } from 'react';

export const FOCUSABLE_DIALOG_SELECTOR = [
    'a[href]',
    'area[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'iframe',
    'object',
    'embed',
    '[contenteditable="true"]',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

export type DialogFocusDirection = 'backward' | 'forward';

export type ResolveNextDialogFocusIndexInput = {
    currentIndex: number;
    direction: DialogFocusDirection;
    focusableCount: number;
};

export type UseDialogFocusTrapOptions = {
    active?: boolean;
    containerReference: RefObject<HTMLElement | null>;
    initialFocusSelector?: string;
    restoreFocus?: boolean;
};

export function collectFocusableDialogElements(container: HTMLElement): HTMLElement[] {
    return [...container.querySelectorAll<HTMLElement>(FOCUSABLE_DIALOG_SELECTOR)]
        .filter((element) => isFocusableDialogElement(element));
}

export function resolveNextDialogFocusIndex({ currentIndex, direction, focusableCount }: ResolveNextDialogFocusIndexInput): number | undefined {
    if (focusableCount <= 0) return undefined;
    if (currentIndex < 0) return direction === 'backward' ? focusableCount - 1 : 0;

    return direction === 'backward'
        ? (currentIndex - 1 + focusableCount) % focusableCount
        : (currentIndex + 1) % focusableCount;
}

export function useDialogFocusTrap({
    active = true,
    containerReference,
    initialFocusSelector,
    restoreFocus = true,
}: UseDialogFocusTrapOptions): void {
    useEffect(() => {
        if (!active) return;

        const container = containerReference.current;
        if (!container) return;

        const ownerDocument = container.ownerDocument;
        const previousFocus = ownerDocument.activeElement instanceof HTMLElement
            ? ownerDocument.activeElement
            : undefined;

        const focusInitialElement = () => {
            if (ownerDocument.activeElement instanceof HTMLElement && container.contains(ownerDocument.activeElement)) {
                return;
            }

            const preferredElement = initialFocusSelector
                ? container.querySelector<HTMLElement>(initialFocusSelector)
                : undefined;
            const nextElement = preferredElement && isFocusableDialogElement(preferredElement)
                ? preferredElement
                : collectFocusableDialogElements(container)[0] ?? container;

            nextElement.focus({ preventScroll: true });
        };

        const focusTimer = globalThis.setTimeout(focusInitialElement, 0);
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.key !== 'Tab') return;

            const focusableElements = collectFocusableDialogElements(container);
            if (focusableElements.length === 0) {
                event.preventDefault();
                container.focus({ preventScroll: true });
                return;
            }

            const direction: DialogFocusDirection = event.shiftKey ? 'backward' : 'forward';
            const currentIndex = ownerDocument.activeElement instanceof HTMLElement
                ? focusableElements.indexOf(ownerDocument.activeElement)
                : -1;
            const nextIndex = resolveNextDialogFocusIndex({
                currentIndex,
                direction,
                focusableCount: focusableElements.length,
            });

            if (nextIndex === undefined) return;

            event.preventDefault();
            focusableElements[nextIndex]?.focus({ preventScroll: true });
        };

        ownerDocument.addEventListener('keydown', onKeyDown, true);

        return () => {
            globalThis.clearTimeout(focusTimer);
            ownerDocument.removeEventListener('keydown', onKeyDown, true);

            if (restoreFocus && previousFocus?.isConnected) {
                previousFocus.focus({ preventScroll: true });
            }
        };
    }, [active, containerReference, initialFocusSelector, restoreFocus]);
}

function hasDisabledProperty(element: HTMLElement): element is { disabled: boolean } & HTMLElement {
    return 'disabled' in element;
}

function hasHiddenOrInertAncestor(element: HTMLElement): boolean {
    let current: HTMLElement | null = element;

    while (current) {
        if (current.hidden) return true;
        if (current.hasAttribute('inert')) return true;
        current = current.parentElement;
    }

    return false;
}

function isFocusableDialogElement(element: HTMLElement): boolean {
    if (element.hidden) return false;
    if (element.getAttribute('aria-disabled') === 'true') return false;
    if (element.getAttribute('aria-hidden') === 'true') return false;
    if (element.tabIndex < 0) return false;
    if (hasDisabledProperty(element) && element.disabled) return false;
    if (hasHiddenOrInertAncestor(element)) return false;

    return true;
}

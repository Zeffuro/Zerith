import type { EngineConfig } from '@zeffuro/zerith-core';

import { focusable, moveFocus } from './playerShellDom';

export function installPlayerShellInput(options: {
    back: () => void;
    canvas: HTMLCanvasElement;
    input: EngineConfig['input'];
    isOpen: () => boolean;
    load: () => void;
    next: () => void;
    open: () => void;
    root: HTMLElement;
    save: () => void;
}): () => void {
    const { back, canvas, input, isOpen, next, open, root } = options;
    const consumed = new Set<string>();
    const menuKey = input?.menuKey ?? 'Escape';
    const backKeys = input?.backKeys ?? ['Escape'];
    const onKeyDown = (event: KeyboardEvent) => {
        if (consumed.has(event.key)) { event.preventDefault(); event.stopImmediatePropagation(); return; }
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        const target = event.target as HTMLElement | null;
        if (!isOpen()) {
            if (target?.closest('input, textarea, select, button, [contenteditable="true"]')) return;
            if (event.key === menuKey) {
                event.preventDefault();
                event.stopImmediatePropagation();
                consumed.add(event.key);
                if (!event.repeat) open();
            } else if (event.key.toLowerCase() === (input?.saveKey ?? 's').toLowerCase()
                || event.key.toLowerCase() === (input?.loadKey ?? 'l').toLowerCase()) {
                event.preventDefault();
                event.stopImmediatePropagation();
                consumed.add(event.key);
                if (!event.repeat) {
                    if (event.key.toLowerCase() === (input?.saveKey ?? 's').toLowerCase()) options.save();
                    else options.load();
                }
            }
            return;
        }
        event.stopImmediatePropagation();
        if (event.key === menuKey || backKeys.includes(event.key)) {
            event.preventDefault();
            consumed.add(event.key);
            if (!event.repeat) back();
        } else if ((input?.confirmKeys ?? ['Enter', ' ']).includes(event.key)) {
            event.preventDefault();
            consumed.add(event.key);
            if (!event.repeat) (document.activeElement as HTMLElement | null)?.click();
        } else if ((input?.navigateUpKeys ?? ['ArrowUp', 'w', 'W']).includes(event.key)
            || (input?.navigateDownKeys ?? ['ArrowDown', 's', 'S']).includes(event.key)) {
            event.preventDefault();
            moveFocus(root, (input?.navigateUpKeys ?? ['ArrowUp', 'w', 'W']).includes(event.key) ? -1 : 1);
        } else if (event.key === 'Tab') {
            event.preventDefault();
            moveFocus(root, event.shiftKey ? -1 : 1);
        }
    };
    const onKeyUp = (event: KeyboardEvent) => {
        if (consumed.delete(event.key)) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    const onFocus = (event: FocusEvent) => {
        if (isOpen() && event.target instanceof Node && !root.contains(event.target)) focusable(root)[0]?.focus();
    };
    let touchTimer: ReturnType<typeof setTimeout> | undefined;
    let touchId: number | undefined;
    let held = false;
    let suppressTouchClick = false;
    const beginPointerGesture = () => { suppressTouchClick = false; };
    const onClick = (event: MouseEvent) => {
        if (!suppressTouchClick || event.detail === 0) return;
        suppressTouchClick = false;
        event.preventDefault();
        event.stopImmediatePropagation();
    };
    const onPointerDown = (event: PointerEvent) => {
        if (isOpen()) return;
        if (event.button === 2) { event.preventDefault(); event.stopImmediatePropagation(); open(); return; }
        if (event.pointerType !== 'touch') return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (touchId !== undefined) return;
        touchId = event.pointerId;
        if (event.isTrusted) canvas.setPointerCapture(event.pointerId);
        held = false;
        touchTimer = setTimeout(() => { held = true; suppressTouchClick = true; open(); }, 550);
    };
    const onPointerUp = (event: PointerEvent) => {
        if (event.pointerId !== touchId) return;
        clearTimeout(touchTimer);
        touchId = undefined;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!held && !isOpen() && event.type !== 'pointercancel') next();
    };
    let frame = 0;
    let buttons: boolean[] = [];
    let axes: readonly number[] = [];
    let wasOpen = false;
    const poll = () => {
        const gamepad = navigator.getGamepads?.()[0];
        const current = gamepad?.buttons.map(value => value.pressed) ?? [];
        const currentAxes = gamepad?.axes ?? [];
        if (isOpen() && wasOpen && document.hasFocus()) {
            const pressed = (index: number) => current[index] && !buttons[index];
            if (pressed(input?.gamepadBackButton ?? 1) || pressed(input?.gamepadMenuButton ?? 9)) back();
            else if (pressed(input?.gamepadConfirmButton ?? 0)) (document.activeElement as HTMLElement | null)?.click();
            else {
                if (pressed(input?.gamepadUpButton ?? 12) || ((currentAxes[1] ?? 0) < -0.5 && (axes[1] ?? 0) >= -0.5)) moveFocus(root, -1);
                if (pressed(input?.gamepadDownButton ?? 13) || ((currentAxes[1] ?? 0) > 0.5 && (axes[1] ?? 0) <= 0.5)) moveFocus(root, 1);
                const direction = pressed(input?.gamepadLeftButton ?? 14) ? -1 : (pressed(input?.gamepadRightButton ?? 15) ? 1 : 0);
                const active = document.activeElement;
                if (direction && active instanceof HTMLInputElement && active.type === 'range') {
                    if (direction > 0) active.stepUp(); else active.stepDown();
                    active.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
        }
        wasOpen = isOpen();
        buttons = current;
        axes = [...currentAxes];
        frame = requestAnimationFrame(poll);
    };
    const clearConsumed = () => consumed.clear();
    globalThis.addEventListener('keydown', onKeyDown, true);
    globalThis.addEventListener('keyup', onKeyUp, true);
    globalThis.addEventListener('blur', clearConsumed);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('pointerdown', beginPointerGesture, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('pointercancel', onPointerUp, true);
    canvas.addEventListener('contextmenu', preventContext);
    canvas.addEventListener('pointerdown', onPointerDown, true);
    frame = requestAnimationFrame(poll);
    return () => {
        cancelAnimationFrame(frame);
        clearTimeout(touchTimer);
        globalThis.removeEventListener('keydown', onKeyDown, true);
        globalThis.removeEventListener('keyup', onKeyUp, true);
        globalThis.removeEventListener('blur', clearConsumed);
        document.removeEventListener('focusin', onFocus);
        document.removeEventListener('pointerdown', beginPointerGesture, true);
        document.removeEventListener('click', onClick, true);
        document.removeEventListener('pointerup', onPointerUp, true);
        document.removeEventListener('pointercancel', onPointerUp, true);
        canvas.removeEventListener('contextmenu', preventContext);
        canvas.removeEventListener('pointerdown', onPointerDown, true);
    };
}

function preventContext(event: Event): void { event.preventDefault(); }


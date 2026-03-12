import { useEffect } from 'react';

import { executeGlobalShortcutAction } from '../store/actions/globalShortcutActions';
import { useEditorStore } from '../store/useEditorStore';

export function useGlobalEditorShortcuts() {
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            void handleGlobalShortcut(event);
        };

        globalThis.addEventListener('keydown', onKeyDown);
        return () => globalThis.removeEventListener('keydown', onKeyDown);
    }, []);
}

async function handleGlobalShortcut(event: KeyboardEvent): Promise<void> {
    if (event.defaultPrevented || event.isComposing || event.key === 'Process') return;

    const module_ = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    const isPlaybackRunning = useEditorStore.getState().playTrigger > useEditorStore.getState().stopTrigger;

    if (event.key === 'F5' && event.shiftKey) {
        const handled = await executeGlobalShortcutAction('stopPlayback');
        if (handled) event.preventDefault();
        return;
    }

    if (event.key === 'F5') {
        const handled = await executeGlobalShortcutAction('continueOrPlay');
        if (handled) event.preventDefault();
        return;
    }

    if (event.key === 'F6') {
        if (!isPlaybackRunning) return;
        const handled = await executeGlobalShortcutAction('pausePlayback');
        if (handled) event.preventDefault();
        return;
    }

    if (event.key === 'F9') {
        if (!isPlaybackRunning) return;
        const handled = await executeGlobalShortcutAction('toggleBreakpoint');
        if (handled) event.preventDefault();
        return;
    }

    if (event.key === 'F10') {
        if (!isPlaybackRunning) return;
        const handled = await executeGlobalShortcutAction('stepPlayback');
        if (handled) event.preventDefault();
        return;
    }

    if (event.key === 'F11' && event.shiftKey) {
        if (!isPlaybackRunning) return;
        const handled = await executeGlobalShortcutAction('stepOutPlayback');
        if (handled) event.preventDefault();
        return;
    }

    if (event.key === 'F11') {
        if (!isPlaybackRunning) return;
        const handled = await executeGlobalShortcutAction('stepIntoPlayback');
        if (handled) event.preventDefault();
        return;
    }

    if (module_ && event.shiftKey && key === 's') {
        event.preventDefault();
        await executeGlobalShortcutAction('saveAll');
        return;
    }

    if (module_ && key === 's') {
        event.preventDefault();
        await executeGlobalShortcutAction('save');
        return;
    }

    if (module_ && event.shiftKey && key === 'f') {
        event.preventDefault();
        await executeGlobalShortcutAction('openGlobalSearchFind');
        return;
    }

    if (module_ && event.shiftKey && key === 'g') {
        event.preventDefault();
        await executeGlobalShortcutAction('openGlobalSearchReplace');
        return;
    }

    if (module_ && event.shiftKey && key === 'p') {
        event.preventDefault();
        await executeGlobalShortcutAction('toggleCommandPalette');
        return;
    }

    if (isTypingTarget(event.target)) return;

    if (module_ && key === 'z' && !event.shiftKey) {
        event.preventDefault();
        await executeGlobalShortcutAction('undo');
        return;
    }

    if ((module_ && key === 'y') || (module_ && event.shiftKey && key === 'z')) {
        event.preventDefault();
        await executeGlobalShortcutAction('redo');
        return;
    }

    if (module_ && key === 'd') {
        event.preventDefault();
        await executeGlobalShortcutAction('duplicate');
        return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
        const handled = await executeGlobalShortcutAction('requestDelete');
        if (handled) {
            event.preventDefault();
        }
        return;
    }

    if (module_ && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        const handled = await executeGlobalShortcutAction(
            event.key === 'ArrowUp' ? 'moveSelectionUp' : 'moveSelectionDown'
        );
        if (handled) {
            event.preventDefault();
        }
        return;
    }

    if (module_ && key === 'c') {
        if (isConsoleTarget(event.target)) {
            return;
        }
        event.preventDefault();
        await executeGlobalShortcutAction('copySelection');
        return;
    }

    if (module_ && key === 'v') {
        const handled = await executeGlobalShortcutAction('pasteSelection');
        if (handled) {
            event.preventDefault();
        }
    }
}

function isConsoleTarget(element: EventTarget | null): boolean {
    const node = element as HTMLElement | null;
    if (!node) return false;
    return Boolean(node.closest('[data-console-panel="true"]'));
}

function isTypingTarget(element: EventTarget | null) {
    const node = element as HTMLElement | null;
    if (!node) return false;
    const tag = node.tagName?.toLowerCase();
    return tag === 'input' || tag === 'textarea' || node.isContentEditable;
}



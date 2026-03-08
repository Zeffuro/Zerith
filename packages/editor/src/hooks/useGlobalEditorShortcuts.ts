import { useEffect } from 'react';

import { executeGlobalShortcutAction } from '../store/actions/globalShortcutActions';

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
    const module_ = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();

    if (module_ && key === 's') {
        event.preventDefault();
        await executeGlobalShortcutAction('save');
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

function isTypingTarget(element: EventTarget | null) {
    const node = element as HTMLElement | null;
    if (!node) return false;
    const tag = node.tagName?.toLowerCase();
    return tag === 'input' || tag === 'textarea' || node.isContentEditable;
}


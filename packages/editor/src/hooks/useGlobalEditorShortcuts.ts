import { useEffect } from 'react';

import { executeGlobalShortcutAction } from '../store/actions/globalShortcutActions';

export function useGlobalEditorShortcuts() {
    useEffect(() => {
        const onKeyDown = async (e: KeyboardEvent) => {
            const module_ = e.ctrlKey || e.metaKey;
            const key = e.key.toLowerCase();

            if (module_ && key === 's') {
                e.preventDefault();
                await executeGlobalShortcutAction('save');
                return;
            }

            if (isTypingTarget(e.target)) return;

            if (module_ && key === 'z' && !e.shiftKey) {
                e.preventDefault();
                await executeGlobalShortcutAction('undo');
                return;
            }

            if ((module_ && key === 'y') || (module_ && e.shiftKey && key === 'z')) {
                e.preventDefault();
                await executeGlobalShortcutAction('redo');
                return;
            }

            if (module_ && key === 'd') {
                e.preventDefault();
                await executeGlobalShortcutAction('duplicate');
                return;
            }

            if (e.key === 'Delete' || e.key === 'Backspace') {
                const handled = await executeGlobalShortcutAction('requestDelete');
                if (handled) {
                    e.preventDefault();
                }
                return;
            }

            if (module_ && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                const handled = await executeGlobalShortcutAction(
                    e.key === 'ArrowUp' ? 'moveSelectionUp' : 'moveSelectionDown'
                );
                if (handled) {
                    e.preventDefault();
                }
                return;
            }

            // COPY
            if (module_ && key === 'c') {
                e.preventDefault();
                await executeGlobalShortcutAction('copySelection');
                return;
            }

            // PASTE
            if (module_ && key === 'v') {
                const handled = await executeGlobalShortcutAction('pasteSelection');
                if (handled) {
                    e.preventDefault();
                }
                return;
            }
        };

        globalThis.addEventListener('keydown', onKeyDown);
        return () => globalThis.removeEventListener('keydown', onKeyDown);
    }, []);
}

function isTypingTarget(element: EventTarget | null) {
    const node = element as HTMLElement | null;
    if (!node) return false;
    const tag = node.tagName?.toLowerCase();
    return tag === 'input' || tag === 'textarea' || node.isContentEditable;
}
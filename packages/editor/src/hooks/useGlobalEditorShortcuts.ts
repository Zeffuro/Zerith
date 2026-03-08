import { useEffect } from 'react';
import { executeGlobalShortcutAction } from '../store/actions/globalShortcutActions';

function isTypingTarget(el: EventTarget | null) {
    const node = el as HTMLElement | null;
    if (!node) return false;
    const tag = node.tagName?.toLowerCase();
    return tag === 'input' || tag === 'textarea' || node.isContentEditable;
}

export function useGlobalEditorShortcuts() {
    useEffect(() => {
        const onKeyDown = async (e: KeyboardEvent) => {
            const mod = e.ctrlKey || e.metaKey;
            const key = e.key.toLowerCase();

            if (mod && key === 's') {
                e.preventDefault();
                await executeGlobalShortcutAction('save');
                return;
            }

            if (isTypingTarget(e.target)) return;

            if (mod && key === 'z' && !e.shiftKey) {
                e.preventDefault();
                await executeGlobalShortcutAction('undo');
                return;
            }

            if ((mod && key === 'y') || (mod && e.shiftKey && key === 'z')) {
                e.preventDefault();
                await executeGlobalShortcutAction('redo');
                return;
            }

            if (mod && key === 'd') {
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

            if (mod && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                const handled = await executeGlobalShortcutAction(
                    e.key === 'ArrowUp' ? 'moveSelectionUp' : 'moveSelectionDown'
                );
                if (handled) {
                    e.preventDefault();
                }
                return;
            }

            // COPY
            if (mod && key === 'c') {
                e.preventDefault();
                await executeGlobalShortcutAction('copySelection');
                return;
            }

            // PASTE
            if (mod && key === 'v') {
                const handled = await executeGlobalShortcutAction('pasteSelection');
                if (handled) {
                    e.preventDefault();
                }
                return;
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);
}
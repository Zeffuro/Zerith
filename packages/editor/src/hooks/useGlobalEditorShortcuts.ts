import { useEffect } from 'react';

import { executeGlobalShortcutAction } from '../store/actions/globalShortcutActions';
import { useEditorStore } from '../store/useEditorStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { resolveGlobalShortcutAction } from './globalShortcutResolver';

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
    const isPlaybackRunning = useEditorStore.getState().playTrigger > useEditorStore.getState().stopTrigger;
    const keymapOverrides = useSettingsStore.getState().keymapOverrides;
    const resolved = resolveGlobalShortcutAction({
        event,
        isConsoleTarget: isConsoleTarget(event.target),
        isPlaybackRunning,
        isTypingTarget: isTypingTarget(event.target),
        keymapOverrides,
    });
    if (!resolved) return;

    if (resolved.preventDefault === 'always') {
        event.preventDefault();
    }

    if (resolved.action === 'openSettingsModal') {
        useEditorStore.getState().openSettingsModal();
        return;
    }

    const handled = await executeGlobalShortcutAction(resolved.action);
    if (resolved.preventDefault === 'whenHandled' && handled) {
        event.preventDefault();
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



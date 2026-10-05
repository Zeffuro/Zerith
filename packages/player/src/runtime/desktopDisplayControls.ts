import type { DesktopPlayerBridge } from './desktopPlayer';

import { fullscreenShortcut } from './desktopPlayer';

export interface PlayerDisplayControls {
    dispose(): void;
    getState(): { available: boolean; fullscreen: boolean; pending: boolean; status: string };
    setFullscreen(fullscreen: boolean): Promise<void>;
    subscribe(listener: () => void): () => void;
}

export function createPlayerDisplayControls(bridge?: DesktopPlayerBridge): PlayerDisplayControls {
    let disposed = false;
    let fullscreen = !bridge && document.fullscreenElement !== null;
    let pending = false;
    let revision = 0;
    let status = '';
    const available = !!bridge || document.fullscreenEnabled === true;
    const listeners = new Set<() => void>();
    const consumedKeys = new Set<string>();
    const update = () => { if (!disposed) for (const listener of listeners) listener(); };
    const setFullscreen = async (value: boolean) => {
        if (pending || disposed || !available) return;
        pending = true;
        revision++;
        status = '';
        update();
        try {
            if (bridge) {
                const state = await bridge.setFullscreen(value);
                fullscreen = state.fullscreen;
            }
            else {
                if (value && !document.fullscreenElement) await document.documentElement.requestFullscreen();
                if (!value && document.fullscreenElement) await document.exitFullscreen();
                fullscreen = !!document.fullscreenElement;
            }
        } catch (error) {
            status = error instanceof Error ? error.message : 'Could not change display mode.';
        } finally { pending = false; update(); }
    };
    const refresh = () => {
        if (pending || disposed) return;
        const requested = revision;
        if (bridge) {
            void bridge.getState().then(next => {
                if (!disposed && requested === revision && !pending) { fullscreen = next.fullscreen; update(); }
            }).catch(() => {
                if (!disposed && requested === revision) { status = 'Could not read display mode.'; update(); }
            });
        } else { fullscreen = !!document.fullscreenElement; update(); }
    };
    const onKeyDown = (event: KeyboardEvent) => {
        const mode = fullscreenShortcut({ altKey: event.altKey, ctrlKey: event.ctrlKey, key: event.key, metaKey: event.metaKey, repeat: false }, fullscreen);
        if (!available || (!consumedKeys.has(event.key) && mode === undefined)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        consumedKeys.add(event.key);
        if (!event.repeat && mode !== undefined) void setFullscreen(mode);
    };
    const onKeyUp = (event: KeyboardEvent) => {
        if (consumedKeys.delete(event.key)) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    const onFocus = () => { consumedKeys.clear(); refresh(); };
    const onBlur = () => consumedKeys.clear();
    globalThis.addEventListener('keydown', onKeyDown, true);
    globalThis.addEventListener('keyup', onKeyUp, true);
    globalThis.addEventListener('focus', onFocus);
    globalThis.addEventListener('blur', onBlur);
    document.addEventListener('fullscreenchange', refresh);
    refresh();
    return {
        dispose: () => {
            disposed = true;
            listeners.clear();
            globalThis.removeEventListener('keydown', onKeyDown, true);
            globalThis.removeEventListener('keyup', onKeyUp, true);
            globalThis.removeEventListener('focus', onFocus);
            globalThis.removeEventListener('blur', onBlur);
            document.removeEventListener('fullscreenchange', refresh);
        },
        getState: () => ({ available, fullscreen, pending, status }),
        setFullscreen,
        subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    };
}


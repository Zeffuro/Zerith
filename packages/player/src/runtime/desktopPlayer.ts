import type { EngineConfig } from '@zeffuro/zerith-core';

export interface DesktopPlayerBridge {
    getState(): Promise<DesktopWindowState>;
    metadata: DesktopPlayerMetadata;
    setFullscreen(fullscreen: boolean): Promise<DesktopWindowState>;
}

export interface DesktopPlayerMetadata {
    gameId: string;
    height: number;
    title: string;
    width: number;
}

export interface DesktopWindowState {
    fullscreen: boolean;
    height: number;
    maximized: boolean;
    width: number;
}

type DesktopWindow = {
    __TAURI_INTERNALS__?: { invoke: (command: string, arguments_?: Record<string, unknown>) => Promise<unknown> };
    __ZERITH_DESKTOP__?: DesktopPlayerMetadata;
};

export function desktopEngineConfig(metadata: DesktopPlayerMetadata, storage: Storage): EngineConfig {
    const prefix = `zerith:${metadata.gameId}:`;
    return {
        display: { scaleMode: 'fit' },
        storage: {
            getItem: key => storage.getItem(`${prefix}${key}`) ?? undefined,
            removeItem: key => storage.removeItem(`${prefix}${key}`),
            setItem: (key, value) => storage.setItem(`${prefix}${key}`, value),
        },
    };
}

export function fullscreenShortcut(event: Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'key' | 'metaKey' | 'repeat'>, fullscreen: boolean): boolean | undefined {
    if (event.ctrlKey || event.metaKey || event.repeat) return;
    if (event.key === 'F11' || (event.altKey && event.key === 'Enter')) return !fullscreen;
}

export function resolveDesktopPlayer(target: unknown): DesktopPlayerBridge | undefined {
    if (!target || typeof target !== 'object') return;
    const environment = target as DesktopWindow;
    const metadata = environment.__ZERITH_DESKTOP__;
    const invoke = environment.__TAURI_INTERNALS__?.invoke;
    if (!metadata || !invoke || !/^games\.[a-z0-9]+\.g[a-f0-9]{12}$/.test(metadata.gameId)
        || typeof metadata.title !== 'string' || metadata.title.length > 256
        || !isDimension(metadata.width, 320) || !isDimension(metadata.height, 240)) return;
    const call = async (command: string, arguments_?: Record<string, unknown>) => {
        const state = await invoke(command, arguments_) as DesktopWindowState;
        if (!state || typeof state.fullscreen !== 'boolean' || typeof state.maximized !== 'boolean'
            || !Number.isFinite(state.width) || !Number.isFinite(state.height)) throw new Error('The player returned invalid window settings.');
        return state;
    };
    return {
        getState: () => call('desktop_get_window_state'),
        metadata,
        setFullscreen: fullscreen => call('desktop_set_fullscreen', { fullscreen }),
    };
}

function isDimension(value: number, minimum: number): boolean {
    return Number.isInteger(value) && value >= minimum && value <= 8192;
}

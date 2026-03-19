import { vi } from 'vitest';

import type { EngineEventMap, IAssetManager, IAudioManager, IEventBus, IStateManager, SfxPlaybackOptions } from '../interfaces/managers';
import type { Serializable } from '../types';
import type { Logger } from '../utils/Logger';

import { createDefaultSystemState } from '../types';

const defaultLoadMock: IAssetManager['load'] = <T = unknown>(url: string) => {
    void url;
    return Promise.resolve(undefined as T);
};

const defaultPlaySfxMock: IAudioManager['playSfx'] = (url: string, volume?: number, options?: SfxPlaybackOptions) => {
    void url;
    void volume;
    void options;
    return Promise.resolve();
};

export function createAssetManagerMock(overrides: Partial<IAssetManager> = {}): IAssetManager {
    const base: IAssetManager = {
        extractAssetUrls: vi.fn(() => ({
            audio: new Set<string>(),
            textures: new Set<string>(),
        })),
        load: vi.fn(defaultLoadMock) as IAssetManager['load'],
        preloadCharacterAssets: vi.fn(() => Promise.resolve()),
        preloadSceneAssets: vi.fn(() => Promise.resolve()),
        resolve: vi.fn((url: string) => url),
        setResolver: vi.fn(),
    };

    return { ...base, ...overrides };
}

export function createAudioManagerMock(overrides: Partial<IAudioManager> = {}): IAudioManager {
    const base: IAudioManager = {
        audioExists: vi.fn(() => false),
        bgmVolume: 1,
        currentBgmUrl: undefined,
        getVolumes: vi.fn(() => ({
            bgmVolume: 1,
            masterVolume: 1,
            muted: false,
            sfxVolume: 1,
            voiceVolume: 1,
        })),
        loadAudiosheet: vi.fn(() => Promise.resolve()),
        masterVolume: 1,
        muted: false,
        pauseBgm: vi.fn(),
        playBgm: vi.fn(() => Promise.resolve()),
        playCue: vi.fn(() => Promise.resolve()),
        playSfx: vi.fn(defaultPlaySfxMock),
        playVoice: vi.fn(() => Promise.resolve()),
        preloadAudio: vi.fn(() => Promise.resolve()),
        resumeBgm: vi.fn(),
        setMasterVolume: vi.fn(),
        setVolume: vi.fn(),
        sfxVolume: 1,
        stopAll: vi.fn(),
        stopBgm: vi.fn(),
        voiceVolume: 1,
    };

    return { ...base, ...overrides };
}

export function createEventBusMock(overrides: Partial<IEventBus> = {}): IEventBus {
    const listeners = new Map<keyof EngineEventMap, Set<(...arguments_: unknown[]) => void>>();

    const base: IEventBus = {
        destroy: vi.fn(() => {
            listeners.clear();
        }),
        emit: vi.fn((event: keyof EngineEventMap, ...arguments_: unknown[]) => {
            const eventListeners = listeners.get(event);
            if (!eventListeners) return;
            for (const listener of eventListeners) {
                listener(...arguments_);
            }
        }) as IEventBus['emit'],
        off: vi.fn((event: keyof EngineEventMap, listener: (...arguments_: unknown[]) => void) => {
            listeners.get(event)?.delete(listener);
        }) as IEventBus['off'],
        on: vi.fn((event: keyof EngineEventMap, listener: (...arguments_: unknown[]) => void) => {
            if (!listeners.has(event)) {
                listeners.set(event, new Set());
            }
            listeners.get(event)?.add(listener);
        }) as IEventBus['on'],
        once: vi.fn((event: keyof EngineEventMap, listener: (...arguments_: unknown[]) => void) => {
            const wrapper = (...arguments_: unknown[]) => {
                listener(...arguments_);
                listeners.get(event)?.delete(wrapper);
            };

            if (!listeners.has(event)) {
                listeners.set(event, new Set());
            }
            listeners.get(event)?.add(wrapper);
        }) as IEventBus['once'],
    };

    return { ...base, ...overrides };
}

export function createLoggerMock(): Logger {
    return {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    } as unknown as Logger;
}

export function createStateManagerMock(overrides: Partial<IStateManager> = {}): IStateManager {
    const state: Record<string, Serializable> = {};
    const persistentState: Record<string, Serializable> = {};
    const system = createDefaultSystemState();
    type SystemStateShape = ReturnType<typeof createDefaultSystemState>;

    const base: IStateManager = {
        clear: vi.fn(() => {
            for (const key of Object.keys(state)) {
                delete state[key];
            }
            const defaultSystem = createDefaultSystemState();
            system.background = defaultSystem.background;
            system.bgm = defaultSystem.bgm;
            system.dialogue = defaultSystem.dialogue;
            system.items = [...defaultSystem.items];
            system.sprites = { ...defaultSystem.sprites };
        }),
        destroy: vi.fn(),
        get: vi.fn((key: string) => state[key]) as IStateManager['get'],
        getPersistent: vi.fn((key: string) => persistentState[key]) as IStateManager['getPersistent'],
        loadPersistentState: vi.fn((nextPersistentState: Record<string, Serializable>) => {
            for (const key of Object.keys(persistentState)) {
                delete persistentState[key];
            }
            Object.assign(persistentState, nextPersistentState);
        }),
        persistentState,
        replaceState: vi.fn((nextState: Record<string, Serializable>, nextSystem?: SystemStateShape) => {
            for (const key of Object.keys(state)) {
                delete state[key];
            }
            Object.assign(state, nextState);

            const resolvedSystem = nextSystem ?? createDefaultSystemState();

            system.background = resolvedSystem.background;
            system.bgm = resolvedSystem.bgm;
            system.dialogue = resolvedSystem.dialogue;
            system.items = [...resolvedSystem.items];
            system.sprites = { ...resolvedSystem.sprites };
        }),
        set: vi.fn((key: string, value: Serializable) => {
            state[key] = value;
        }) as IStateManager['set'],
        setPersistent: vi.fn((key: string, value: Serializable) => {
            persistentState[key] = value;
        }) as IStateManager['setPersistent'],
        state,
        system,
    };

    return { ...base, ...overrides };
}


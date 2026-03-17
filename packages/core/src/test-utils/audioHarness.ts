import { vi } from 'vitest';

import type { IAssetManager, IAudioManager, SfxPlaybackOptions } from '../interfaces/managers';
import type { Logger } from '../utils/Logger';

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
        masterVolume: 1,
        muted: false,
        pauseBgm: vi.fn(),
        playBgm: vi.fn(() => Promise.resolve()),
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

export function createLoggerMock(): Logger {
    return {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    } as unknown as Logger;
}


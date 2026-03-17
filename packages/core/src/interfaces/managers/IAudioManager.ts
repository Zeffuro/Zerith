import type { AudioConfig } from '../../managers/AudioManager';
import type { IBaseManager } from './IBaseManager';

export interface IAudioManager extends IBaseManager {
    audioExists(url: string): boolean;
    bgmVolume: number;
    currentBgmUrl: string | undefined;
    getVolumes(): Required<AudioConfig>;
    masterVolume: number;
    muted: boolean;
    pauseBgm(): void;
    playBgm(url: string, loop: boolean, volume?: number): Promise<void>;
    playSfx(url: string, volume?: number, options?: SfxPlaybackOptions): Promise<void>;
    playVoice(url: string): Promise<void>;
    preloadAudio(url: string): Promise<void>;
    resumeBgm(): void;
    setMasterVolume(v: number): void;
    setVolume(channel: 'bgm' | 'sfx' | 'voice', v: number): void;
    sfxVolume: number;
    stopAll(): void;
    stopBgm(): void;
    voiceVolume: number;
}

export interface SfxPlaybackOptions {
    duration?: number;
    loop?: boolean;
    start?: number;
}

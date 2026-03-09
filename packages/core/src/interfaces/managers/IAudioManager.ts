import type { AudioConfig } from '../../managers/AudioManager';
import type { IBaseManager } from './IBaseManager';

export interface IAudioManager extends IBaseManager {
    bgmVolume: number;
    currentBgmUrl: string | undefined;
    masterVolume: number;
    muted: boolean;
    sfxVolume: number;
    voiceVolume: number;
    getVolumes(): Required<AudioConfig>;
    setMasterVolume(v: number): void;
    setVolume(channel: 'bgm' | 'sfx' | 'voice', v: number): void;
}


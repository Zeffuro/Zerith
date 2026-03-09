import type { AudioConfig } from '../../managers/AudioManager';
import type { IBaseManager } from './IBaseManager';

export interface IAudioManager extends IBaseManager {
    bgmVolume: number;
    currentBgmUrl: string | undefined;
    getVolumes(): Required<AudioConfig>;
    masterVolume: number;
    muted: boolean;
    setMasterVolume(v: number): void;
    setVolume(channel: 'bgm' | 'sfx' | 'voice', v: number): void;
    sfxVolume: number;
    voiceVolume: number;
}


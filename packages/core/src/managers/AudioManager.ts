import { sound } from '@pixi/sound';

export interface AudioConfig {
    bgmVolume?: number;
    sfxVolume?: number;
    voiceVolume?: number;
    masterVolume?: number;
}

export class AudioManager {
    public bgmVolume: number;
    public sfxVolume: number;
    public voiceVolume: number;
    public masterVolume: number;

    public currentBgmUrl: string | null = null;

    constructor(config: AudioConfig = {}) {
        this.bgmVolume = config.bgmVolume ?? 1.0;
        this.sfxVolume = config.sfxVolume ?? 1.0;
        this.voiceVolume = config.voiceVolume ?? 1.0;
        this.masterVolume = config.masterVolume ?? 1.0;
    }

    public init() {
        sound.init();
        if (this.masterVolume !== 1.0) {
            sound.volumeAll = this.masterVolume;
        }
    }

    public setMasterVolume(v: number) {
        this.masterVolume = v;
        sound.volumeAll = v;
    }

    public setVolume(channel: 'bgm' | 'sfx' | 'voice', v: number) {
        switch (channel) {
            case 'bgm':
                this.bgmVolume = v;
                this.applyBgmVolume();
                break;
            case 'sfx':
                this.sfxVolume = v;
                break;
            case 'voice':
                this.voiceVolume = v;
                break;
        }
    }

    private applyBgmVolume() {
        if (!this.currentBgmUrl || !sound.exists(this.currentBgmUrl)) return;
        const snd = sound.find(this.currentBgmUrl);
        if (snd) {
            snd.volume = this.bgmVolume;
        }
    }

    public getVolumes(): Required<AudioConfig> {
        return {
            bgmVolume: this.bgmVolume,
            sfxVolume: this.sfxVolume,
            voiceVolume: this.voiceVolume,
            masterVolume: this.masterVolume
        };
    }

    public destroy() {
        sound.stopAll();
        sound.removeAll();
    }
}
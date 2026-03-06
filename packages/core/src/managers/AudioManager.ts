import { sound } from '@pixi/sound';

export interface AudioConfig {
    bgmVolume?: number;
    sfxVolume?: number;
    voiceVolume?: number;
    masterVolume?: number;
    muted?: boolean;
}

export class AudioManager {
    public bgmVolume: number;
    public sfxVolume: number;
    public voiceVolume: number;
    public masterVolume: number;

    private _muted: boolean = false;

    public currentBgmUrl: string | null = null;

    constructor(config: AudioConfig = {}) {
        this.bgmVolume = config.bgmVolume ?? 1.0;
        this.sfxVolume = config.sfxVolume ?? 1.0;
        this.voiceVolume = config.voiceVolume ?? 1.0;
        this.masterVolume = config.masterVolume ?? 1.0;
        this._muted = config.muted ?? false;
    }

    public init() {
        sound.init();
        this.updateSystemVolume();
    }

    public get muted(): boolean {
        return this._muted;
    }

    public set muted(value: boolean) {
        this._muted = value;
        this.updateSystemVolume();
    }

    public setMasterVolume(v: number) {
        this.masterVolume = v;
        this.updateSystemVolume();
    }

    private updateSystemVolume() {
        if (this._muted) {
            sound.volumeAll = 0;
        } else {
            sound.volumeAll = this.masterVolume;
        }
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
            masterVolume: this.masterVolume,
            muted: this._muted
        };
    }

    public destroy() {
        sound.stopAll();
        sound.removeAll();
    }
}
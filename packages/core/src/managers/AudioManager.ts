import { sound } from '@pixi/sound';

export interface AudioConfig {
    bgmVolume?: number;
    masterVolume?: number;
    muted?: boolean;
    sfxVolume?: number;
    voiceVolume?: number;
}

export class AudioManager {
    public bgmVolume: number;
    public currentBgmUrl: null | string = null;
    public masterVolume: number;
    public sfxVolume: number;

    public voiceVolume: number;

    public get muted(): boolean {
        return this._muted;
    }

    public set muted(value: boolean) {
        this._muted = value;
        this.updateSystemVolume();
    }

    private _muted: boolean = false;

    constructor(config: AudioConfig = {}) {
        this.bgmVolume = config.bgmVolume ?? 1;
        this.sfxVolume = config.sfxVolume ?? 1;
        this.voiceVolume = config.voiceVolume ?? 1;
        this.masterVolume = config.masterVolume ?? 1;
        this._muted = config.muted ?? false;
    }

    public destroy() {
        sound.stopAll();
        sound.removeAll();
    }

    public getVolumes(): Required<AudioConfig> {
        return {
            bgmVolume: this.bgmVolume,
            masterVolume: this.masterVolume,
            muted: this._muted,
            sfxVolume: this.sfxVolume,
            voiceVolume: this.voiceVolume
        };
    }

    public init() {
        sound.init();
        this.updateSystemVolume();
    }

    public setMasterVolume(v: number) {
        this.masterVolume = v;
        this.updateSystemVolume();
    }

    public setVolume(channel: 'bgm' | 'sfx' | 'voice', v: number) {
        switch (channel) {
            case 'bgm': {
                this.bgmVolume = v;
                this.applyBgmVolume();
                break;
            }
            case 'sfx': {
                this.sfxVolume = v;
                break;
            }
            case 'voice': {
                this.voiceVolume = v;
                break;
            }
        }
    }

    private applyBgmVolume() {
        if (!this.currentBgmUrl || !sound.exists(this.currentBgmUrl)) return;
        const snd = sound.find(this.currentBgmUrl);
        if (snd) {
            snd.volume = this.bgmVolume;
        }
    }

    private updateSystemVolume() {
        sound.volumeAll = this._muted ? 0 : this.masterVolume;
    }
}
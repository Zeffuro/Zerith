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
    public currentBgmUrl: string | undefined;
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

    public audioExists(url: string): boolean {
        return sound.exists(url);
    }

    public destroy() {
        sound.stopAll();
        sound.removeAll();
        this.currentBgmUrl = undefined;
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


    public pauseBgm(): void {
        if (!this.currentBgmUrl) return;
        sound.pause(this.currentBgmUrl);
    }

    public async playBgm(url: string, loop: boolean, volume: number = 1): Promise<void> {
        await this.preloadAudio(url);

        if (this.currentBgmUrl && this.currentBgmUrl !== url) {
            sound.stop(this.currentBgmUrl);
        }

        this.currentBgmUrl = url;
        await sound.play(url, {
            loop,
            singleInstance: true,
            volume: volume * this.bgmVolume,
        });
    }

    public async playSfx(url: string, volume: number = 1): Promise<void> {
        await this.preloadAudio(url);
        await sound.play(url, { volume: volume * this.sfxVolume });
    }

    public async playVoice(url: string): Promise<void> {
        await this.preloadAudio(url);
        await sound.play(url, { volume: 0.1 * this.voiceVolume });
    }

    public async preloadAudio(url: string): Promise<void> {
        if (this.audioExists(url)) return;

        await new Promise<void>((resolve, reject) => {
            sound.add(url, {
                loaded: (error) => error ? reject(error) : resolve(),
                preload: true,
                url,
            });
        });
    }

    public resumeBgm(): void {
        if (!this.currentBgmUrl) return;
        sound.resume(this.currentBgmUrl);
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

    public stopAll(): void {
        sound.stopAll();
        this.currentBgmUrl = undefined;
    }

    public stopBgm(): void {
        if (!this.currentBgmUrl) return;
        sound.stop(this.currentBgmUrl);
        this.currentBgmUrl = undefined;
    }

    private applyBgmVolume() {
        if (!this.currentBgmUrl || !sound.exists(this.currentBgmUrl)) return;
        const snd = sound['find'](this.currentBgmUrl);
        if (snd) {
            snd.volume = this.bgmVolume;
        }
    }

    private updateSystemVolume() {
        sound.volumeAll = this._muted ? 0 : this.masterVolume;
    }
}
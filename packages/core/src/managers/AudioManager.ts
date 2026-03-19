import { sound } from '@pixi/sound';

import type { CuePlaybackOptions } from '../interfaces/managers';
import type { AudioCue, AudiosheetDescriptor } from '../types';

export interface AudioConfig {
    bgmVolume?: number;
    masterVolume?: number;
    muted?: boolean;
    sfxVolume?: number;
    voiceVolume?: number;
}

type AudiosheetRuntimeDescriptor = {
    cues: Record<string, AudioCue>;
    source: string;
};

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
    private readonly audiosheets = new Map<string, AudiosheetRuntimeDescriptor>();

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

    public async loadAudiosheet(sheetName: string, descriptor: AudiosheetDescriptor): Promise<void> {
        this.audiosheets.set(sheetName, {
            cues: descriptor.cues,
            source: descriptor.source,
        });
        await this.preloadAudio(descriptor.source);
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

    public async playCue(
        sheetName: string,
        cueName: string,
        options: CuePlaybackOptions = {},
    ): Promise<void> {
        const descriptor = this.audiosheets.get(sheetName);
        if (!descriptor) {
            throw new Error(`Audiosheet '${sheetName}' is not loaded.`);
        }

        const cue = descriptor.cues[cueName];
        if (!cue) {
            throw new Error(`Cue '${cueName}' not found in audiosheet '${sheetName}'.`);
        }

        const channel = options.channel ?? 'sfx';
        const cueVolume = cue.volume === undefined ? (options.volume ?? 1) : (options.volume ?? 1) * cue.volume;
        const playback = toCuePlaybackOptions(cue, channel, options.loop);
        await this.preloadAudio(descriptor.source);

        if (channel === 'bgm') {
            if (this.currentBgmUrl && this.currentBgmUrl !== descriptor.source) {
                sound.stop(this.currentBgmUrl);
            }
            this.currentBgmUrl = descriptor.source;
            await sound.play(descriptor.source, {
                ...playback,
                singleInstance: true,
                volume: cueVolume * this.bgmVolume,
            });
            return;
        }

        await sound.play(descriptor.source, {
            ...playback,
            volume: cueVolume * this.sfxVolume,
        });
    }

    public async playSfx(
        url: string,
        volume: number = 1,
        options?: { duration?: number; loop?: boolean; start?: number },
    ): Promise<void> {
        await this.preloadAudio(url);
        const start = options?.start;
        const end = options?.duration === undefined
            ? undefined
            : (start ?? 0) + options.duration;

        await sound.play(url, {
            end,
            loop: options?.loop ?? false,
            start,
            volume: volume * this.sfxVolume,
        });
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

function toCuePlaybackOptions(
    cue: AudioCue,
    channel: 'bgm' | 'sfx',
    loopOverride?: boolean,
): { end?: number; loop: boolean; start: number } {
    const start = cue.start;
    const end = cue.duration === undefined ? undefined : start + cue.duration;

    return {
        end,
        loop: loopOverride ?? cue.loop ?? (channel === 'bgm'),
        start,
    };
}


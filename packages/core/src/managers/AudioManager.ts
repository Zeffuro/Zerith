import type { Sound } from '@pixi/sound';

import { sound } from '@pixi/sound';
import { DOMAdapter } from 'pixi.js';

import type { CuePlaybackOptions } from '../interfaces/managers';
import type { AudioCue, AudiosheetDescriptor } from '../types';

export interface AudioConfig {
    bgmVolume?: number;
    defaultBlipUrl?: null | string;
    masterVolume?: number;
    muted?: boolean;
    sfxVolume?: number;
    voiceVolume?: number;
}

type AudiosheetRuntimeDescriptor = {
    cues: Record<string, AudioCue>;
    source: string;
};

type OwnedAudio = {
    abort: AbortController;
    alias: string;
    disposalRequested: boolean;
    disposed: boolean;
    loading: boolean;
    sound?: Sound;
};

let nextAudioOwner = 0;

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
    private readonly audio = new Map<string, OwnedAudio>();
    private readonly audiosheets = new Map<string, AudiosheetRuntimeDescriptor>();
    private bgmEpoch = 0;
    private currentBgmVolume = 1;
    private destroyed = false;
    private nextAlias = 0;
    private readonly owner = ++nextAudioOwner;
    private readonly pendingAudio = new Map<string, { cancel: () => void; promise: Promise<void> }>();
    private playbackEpoch = 0;

    constructor(config: AudioConfig = {}) {
        this.bgmVolume = config.bgmVolume ?? 1;
        this.sfxVolume = config.sfxVolume ?? 1;
        this.voiceVolume = config.voiceVolume ?? 1;
        this.masterVolume = config.masterVolume ?? 1;
        this._muted = config.muted ?? false;
    }

    public audioExists(url: string): boolean {
        return !this.destroyed && this.findAudio(url)?.sound?.isLoaded === true;
    }

    public destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        for (const pending of this.pendingAudio.values()) pending.cancel();
        this.pendingAudio.clear();
        this.audiosheets.clear();
        for (const owned of this.audio.values()) this.disposeAudio(owned);
        this.audio.clear();
        this.currentBgmUrl = undefined;
    }


    public getVolumes(): Required<Omit<AudioConfig, 'defaultBlipUrl'>> {
        return {
            bgmVolume: this.bgmVolume,
            masterVolume: this.masterVolume,
            muted: this._muted,
            sfxVolume: this.sfxVolume,
            voiceVolume: this.voiceVolume
        };
    }


    public init() {
        this.assertActive();
        this.updateSystemVolume();
    }

    public async loadAudiosheet(sheetName: string, descriptor: AudiosheetDescriptor): Promise<void> {
        await this.preloadAudio(descriptor.source);
        if (this.destroyed) throw new Error('Audio manager was destroyed while loading.');
        this.audiosheets.set(sheetName, {
            cues: descriptor.cues,
            source: descriptor.source,
        });
    }


    public pauseBgm(): void {
        if (!this.currentBgmUrl) return;
        const owned = this.findAudio(this.currentBgmUrl);
        if (owned) sound.pause(owned.alias);
    }

    public async playBgm(url: string, loop: boolean, volume: number = 1): Promise<void> {
        const epoch = this.bgmEpoch;
        await this.preloadAudio(url);
        this.assertActive();
        if (epoch !== this.bgmEpoch) return;

        if (this.currentBgmUrl && this.currentBgmUrl !== url) {
            this.stopAudio(this.currentBgmUrl);
        }

        this.currentBgmUrl = url;
        this.currentBgmVolume = volume;
        await sound.play(this.requireAudio(url).alias, {
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
        const epoch = channel === 'bgm' ? this.bgmEpoch : this.playbackEpoch;
        await this.preloadAudio(descriptor.source);
        this.assertActive();
        if (epoch !== (channel === 'bgm' ? this.bgmEpoch : this.playbackEpoch)) return;

        if (channel === 'bgm') {
            if (this.currentBgmUrl && this.currentBgmUrl !== descriptor.source) {
                this.stopAudio(this.currentBgmUrl);
            }
            this.currentBgmUrl = descriptor.source;
            this.currentBgmVolume = cueVolume;
            await sound.play(this.requireAudio(descriptor.source).alias, {
                ...playback,
                singleInstance: true,
                volume: cueVolume * this.bgmVolume,
            });
            return;
        }

        await sound.play(this.requireAudio(descriptor.source).alias, {
            ...playback,
            volume: cueVolume * this.sfxVolume,
        });
    }

    public async playSfx(
        url: string,
        volume: number = 1,
        options?: { duration?: number; loop?: boolean; start?: number },
    ): Promise<void> {
        const epoch = this.playbackEpoch;
        await this.preloadAudio(url);
        this.assertActive();
        if (epoch !== this.playbackEpoch) return;
        const start = options?.start;
        const end = options?.duration === undefined
            ? undefined
            : (start ?? 0) + options.duration;

        await sound.play(this.requireAudio(url).alias, {
            end,
            loop: options?.loop ?? false,
            start,
            volume: volume * this.sfxVolume,
        });
    }

    public async playVoice(url: string): Promise<void> {
        const epoch = this.playbackEpoch;
        await this.preloadAudio(url);
        this.assertActive();
        if (epoch !== this.playbackEpoch) return;
        await sound.play(this.requireAudio(url).alias, { volume: 0.1 * this.voiceVolume });
    }

    public preloadAudio(url: string): Promise<void> {
        if (this.destroyed) return Promise.reject(new Error('Audio manager is destroyed.'));
        const existing = this.pendingAudio.get(url);
        if (existing) return existing.promise;
        if (this.audioExists(url)) return Promise.resolve();

        let resolveLoad!: () => void;
        let rejectLoad!: (error: unknown) => void;
        const previous = this.audio.get(url);
        if (previous) this.disposeAudio(previous);
        const owned: OwnedAudio = {
            abort: new AbortController(),
            alias: `zerith-audio-${this.owner}-${++this.nextAlias}`,
            disposalRequested: false,
            disposed: false,
            loading: true,
        };
        this.audio.set(url, owned);
        const loaded = new Promise<void>((resolve, reject) => {
            resolveLoad = resolve;
            rejectLoad = reject;
        });
        const pending = {
            cancel: () => rejectLoad(new Error('Audio manager was destroyed while loading.')),
            promise: loaded.then(() => {
                if (this.destroyed) throw new Error('Audio manager was destroyed while loading.');
                if (!this.audioExists(url) || this.audio.get(url) !== owned) {
                    throw new Error(`Audio '${url}' was replaced before loading finished.`);
                }
            }).catch((error: unknown) => {
                this.disposeAudio(owned);
                if (this.audio.get(url) === owned) this.audio.delete(url);
                throw error;
            }).finally(() => {
                if (this.pendingAudio.get(url) === pending) this.pendingAudio.delete(url);
            }),
        };
        this.pendingAudio.set(url, pending);
        void this.loadAudio(owned, url, resolveLoad, rejectLoad);
        return pending.promise;
    }

    public resumeBgm(): void {
        if (!this.currentBgmUrl) return;
        const owned = this.findAudio(this.currentBgmUrl);
        if (owned) sound.resume(owned.alias);
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
        this.playbackEpoch++;
        this.bgmEpoch++;
        for (const url of this.audio.keys()) this.stopAudio(url);
        this.currentBgmUrl = undefined;
    }

    public stopBgm(): void {
        this.bgmEpoch++;
        if (!this.currentBgmUrl) return;
        this.stopAudio(this.currentBgmUrl);
        this.currentBgmUrl = undefined;
    }

    private applyBgmVolume() {
        if (!this.currentBgmUrl) return;
        const snd = this.findAudio(this.currentBgmUrl)?.sound;
        if (!snd) return;
        for (const instance of snd.instances) instance.volume = this.currentBgmVolume * this.bgmVolume;
    }

    private assertActive() {
        if (this.destroyed) throw new Error('Audio manager is destroyed.');
    }

    private disposeAudio(owned: OwnedAudio) {
        if (owned.disposed) return;
        owned.disposalRequested = true;
        owned.abort.abort();
        // Pixi decoding still dereferences its media until the loaded callback runs.
        if (owned.sound && owned.loading) return;
        owned.disposed = true;
        if (!owned.sound) return;
        if (sound.exists(owned.alias) && sound['find'](owned.alias) === owned.sound) sound.remove(owned.alias);
        else if (owned.sound.media) owned.sound.destroy();
    }

    private findAudio(url: string): OwnedAudio | undefined {
        const owned = this.audio.get(url);
        return owned && !owned.disposalRequested && sound.exists(owned.alias) && sound['find'](owned.alias) === owned.sound
            ? owned
            : undefined;
    }

    private async loadAudio(owned: OwnedAudio, url: string, resolve: () => void, reject: (error: unknown) => void) {
        try {
            let source: ArrayBuffer | undefined;
            if (!sound.useLegacy) {
                const response = await DOMAdapter.get().fetch(url, { signal: owned.abort.signal });
                if (!response.ok) throw new Error(`Audio '${url}' failed to load (${response.status}).`);
                source = await response.arrayBuffer();
            }
            this.assertActive();
            while (sound.exists(owned.alias)) owned.alias = `zerith-audio-${this.owner}-${++this.nextAlias}`;
            owned.sound = sound.add(owned.alias, {
                loaded: (error) => {
                    owned.loading = false;
                    if (owned.disposalRequested) this.disposeAudio(owned);
                    if (error) reject(error);
                    else resolve();
                },
                preload: true,
                source,
                url,
            });
            if (owned.sound) owned.sound.volume = this._muted ? 0 : this.masterVolume;
        } catch (error) {
            owned.loading = false;
            reject(error);
        }
    }

    private requireAudio(url: string): OwnedAudio {
        const owned = this.findAudio(url);
        if (!owned) throw new Error(`Audio '${url}' was replaced before playback.`);
        return owned;
    }

    private stopAudio(url: string) {
        const owned = this.findAudio(url);
        if (owned) sound.stop(owned.alias);
    }

    private updateSystemVolume() {
        for (const url of this.audio.keys()) {
            const snd = this.findAudio(url)?.sound;
            if (snd) snd.volume = this._muted ? 0 : this.masterVolume;
        }
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


import { Assets } from 'pixi.js';

import type { AssetResolver } from '../Engine';
import type { BackgroundCommand } from '../handlers/BackgroundHandler';
import type { BgmCommand } from '../handlers/BgmHandler';
import type { BlockCommand } from '../handlers/BlockHandler';
import type { ChoiceCommand } from '../handlers/ChoiceHandler';
import type { ForCommand } from '../handlers/ForHandler';
import type { IfCommand } from '../handlers/IfHandler';
import type { SfxCommand } from '../handlers/SfxHandler';
import type { SpriteCommand } from '../handlers/SpriteHandler';
import type { WhileCommand } from '../handlers/WhileHandler';
import type { IAudioManager } from '../interfaces/managers';
import type { BaseCommand, CharacterDefinition, Script, SpritesheetConfig } from '../types';
import type { SpritesheetManager } from './SpritesheetManager';

import { parseAudiosheetDescriptor } from '../schemas';
import { Logger } from '../utils/Logger';

export class AssetManager {
    private readonly audio: IAudioManager;
    private readonly loadedUrls: Set<string> = new Set();
    private readonly logger = new Logger('[AssetManager]');
    private resolver: AssetResolver;

    private readonly spritesheets: SpritesheetManager;

    constructor(audio: IAudioManager, spritesheets: SpritesheetManager, resolver: AssetResolver = (url) => url) {
        this.audio = audio;
        this.spritesheets = spritesheets;
        this.resolver = resolver;
    }

    public static extractAssetUrls(script: Script, includeAudioCues = false): { audio: Set<string>; textures: Set<string>; } {
        const textures = new Set<string>();
        const audio = new Set<string>();

        const walk = (cmds: BaseCommand[]) => {
            for (const cmd of cmds) {
                if (cmd.type === 'background') {
                    const bgCmd = cmd as BackgroundCommand;
                    if (bgCmd.assetUrl) textures.add(bgCmd.assetUrl);
                }
                if (cmd.type === 'sfx') {
                    const sfxCmd = cmd as SfxCommand;
                    if (sfxCmd.assetUrl && (includeAudioCues || !isCueReference(sfxCmd.assetUrl))) audio.add(sfxCmd.assetUrl);
                }
                if (cmd.type === 'bgm') {
                    const bgmCmd = cmd as BgmCommand;
                    if (bgmCmd.assetUrl && (includeAudioCues || !isCueReference(bgmCmd.assetUrl))) audio.add(bgmCmd.assetUrl);
                }
                if (cmd.type === 'sprite') {
                    const spriteCmd = cmd as SpriteCommand;
                    if (spriteCmd.assetUrl) textures.add(spriteCmd.assetUrl);
                }

                if (cmd.type === 'block') {
                    const blockCmd = cmd as BlockCommand;
                    if (Array.isArray(blockCmd.commands)) {
                        walk(blockCmd.commands);
                    }
                }
                if (cmd.type === 'choice') {
                    const choiceCmd = cmd as ChoiceCommand;
                    for (const option of choiceCmd.options) {
                        if (Array.isArray(option.commands)) walk(option.commands);
                    }
                }
                if (cmd.type === 'if') {
                    const ifCmd = cmd as IfCommand;
                    if (Array.isArray(ifCmd.onTrue)) walk(ifCmd.onTrue);
                    if (Array.isArray(ifCmd.onFalse)) walk(ifCmd.onFalse);
                }
                if (cmd.type === 'while') {
                    const whileCmd = cmd as WhileCommand;
                    if (Array.isArray(whileCmd.body)) walk(whileCmd.body);
                }
                if (cmd.type === 'for') {
                    const forCmd = cmd as ForCommand;
                    if (Array.isArray(forCmd.body)) {
                        walk(forCmd.body);
                    }
                }
            }
        };

        walk(script);
        return { audio, textures };
    }

    public destroy() {
        for (const key of this.loadedUrls) {
            const separatorIndex = key.indexOf(':');
            if (separatorIndex === -1) continue;

            const kind = key.slice(0, separatorIndex);
            const rawUrl = key.slice(separatorIndex + 1);

            if (kind === 'texture' || kind === 'sheet') {
                void Assets.unload(rawUrl).catch(() => {
                    // Ignore cache eviction races/duplicates during teardown.
                });
            }
        }

        this.loadedUrls.clear();
    }

    public extractAssetUrls(script: Script, includeAudioCues = false): { audio: Set<string>; textures: Set<string>; } {
        return AssetManager.extractAssetUrls(script, includeAudioCues);
    }

    public async load<T = unknown>(url: string): Promise<T> {
        return await Assets.load<T>(await this.resolve(url));
    }

    public async preloadCharacterAssets(characters: Record<string, CharacterDefinition>): Promise<void> {
        if (Object.keys(characters).length === 0) return;

        const tasks: Promise<void>[] = [];

        for (const char of Object.values(characters)) {
            if (!char || typeof char !== 'object') continue;

            if (char.portraitUrl) {
                tasks.push(this.preloadTexture(char.portraitUrl));
            }

            if (char.blipUrl) {
                tasks.push(this.preloadAudio(char.blipUrl));
            }

            if (char.spritesheet) {
                tasks.push(this.preloadSpritesheet(char.spritesheet));
            }
        }

        await Promise.all(tasks);
    }

    public async preloadSceneAssets(script: Script, options?: { strict?: boolean }): Promise<void> {
        const strict = options?.strict ?? false;
        const { audio, textures } = this.extractAssetUrls(script, strict);

        const texturePromises = [...textures].map((url) => this.preloadTexture(url, strict));
        const audioPromises = [...audio].map((url) => strict && isCueReference(url) ? this.preloadAudioCue(url) : this.preloadAudio(url, strict));

        await Promise.all([...texturePromises, ...audioPromises]);
        this.logger.info(`Preloaded ${textures.size} textures, ${audio.size} audio files.`);
    }

    public async resolve(url: string): Promise<string> {
        return this.resolver(url);
    }

    public setResolver(resolver: AssetResolver) {
        this.resolver = resolver;
    }

    private async preloadAudio(url: string, strict = false): Promise<void> {
        const resolvedUrl = await this.resolve(url);
        const key = `audio:${resolvedUrl}`;
        if (this.loadedUrls.has(key) || this.audio.audioExists(resolvedUrl)) {
            this.loadedUrls.add(key);
            return;
        }

        try {
            await this.audio.preloadAudio(resolvedUrl);
            this.loadedUrls.add(key);
        } catch (error) {
            if (strict) throw error;
            this.logger.warn(`Failed to preload audio: ${url}`, error);
        }
    }

    private async preloadAudioCue(url: string): Promise<void> {
        const separator = url.lastIndexOf(':');
        if (separator <= 0 || separator === url.length - 1) throw new Error(`Invalid audio cue '${url}'.`);
        const sheetUrl = url.slice(0, separator);
        const cueName = url.slice(separator + 1);
        const descriptor = parseAudiosheetDescriptor(await this.load<unknown>(sheetUrl));
        if (!descriptor.success) throw new Error(`Invalid audiosheet '${sheetUrl}': ${descriptor.error}`);
        if (!Object.hasOwn(descriptor.data.cues, cueName)) throw new Error(`Audio cue '${cueName}' is missing from '${sheetUrl}'.`);
        const source = descriptor.data.source;
        const directory = sheetUrl.slice(0, Math.max(0, sheetUrl.lastIndexOf('/') + 1));
        const sourceUrl = source.startsWith('/') || /^[a-z][a-z+.-]*:\/\//i.test(source) ? source : `${directory}${source}`;
        await this.audio.loadAudiosheet(sheetUrl, { ...descriptor.data, source: await this.resolve(sourceUrl) });
    }

    private async preloadSpritesheet(config: SpritesheetConfig): Promise<void> {
        const resolvedAtlasUrl = await this.resolve(config.atlasUrl);
        const key = `sheet:${resolvedAtlasUrl}`;
        if (this.loadedUrls.has(key)) return;

        try {
            await this.spritesheets.load(config);
            this.loadedUrls.add(key);
        } catch (error) {
            this.logger.warn(`Failed to preload spritesheet: ${config.atlasUrl}`, error);
        }
    }

    private async preloadTexture(url: string, strict = false): Promise<void> {
        const resolvedUrl = await this.resolve(url);
        const key = `texture:${resolvedUrl}`;
        if (this.loadedUrls.has(key)) return;

        try {
            const texture = await Assets.load<unknown>(resolvedUrl);
            if (strict && !texture) throw new Error(`Texture '${url}' could not be loaded.`);
            this.loadedUrls.add(key);
        } catch (error) {
            if (strict) throw error;
            this.logger.warn(`Failed to preload texture: ${url}`, error);
        }
    }
}

function isCueReference(assetUrl: string): boolean {
    return assetUrl.includes(':') && !/^[a-z][a-z+.-]*:\/\//i.test(assetUrl);
}

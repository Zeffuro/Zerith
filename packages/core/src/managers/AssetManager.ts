import { sound } from '@pixi/sound';
import { Assets } from 'pixi.js';

import type { AssetResolver } from '../Engine';
import type { BaseCommand, CharacterDefinition, Script, SpritesheetConfig } from '../types';
import type { SpritesheetManager } from './SpritesheetManager';

import { Logger } from '../utils/Logger';

export class AssetManager {
    private readonly loadedUrls: Set<string> = new Set();
    private readonly logger = new Logger('[AssetManager]');
    private resolver: AssetResolver;

    private readonly spritesheets: SpritesheetManager;

    constructor(spritesheets: SpritesheetManager, resolver: AssetResolver = (url) => url) {
        this.spritesheets = spritesheets;
        this.resolver = resolver;
    }

    public static extractAssetUrls(script: Script): { audio: Set<string>; textures: Set<string>; } {
        const textures = new Set<string>();
        const audio = new Set<string>();

        const walk = (commands: BaseCommand[]) => {
            for (const cmd of commands) {
                if ((cmd.type === 'background' || cmd.type === 'scene_change') && cmd.assetUrl) {
                    textures.add(cmd.assetUrl);
                }
                if (cmd.type === 'sprite' && cmd.assetUrl) {
                    textures.add(cmd.assetUrl);
                }
                if (cmd.type === 'bgm' && cmd.action === 'play' && cmd.assetUrl) {
                    audio.add(cmd.assetUrl);
                }
                if (cmd.type === 'sfx' && cmd.assetUrl) {
                    audio.add(cmd.assetUrl);
                }
                if (cmd.type === 'block' && Array.isArray(cmd.commands)) {
                    walk(cmd.commands);
                }
                if (cmd.type === 'if') {
                    if (Array.isArray(cmd.then)) walk(cmd.then);
                    if (Array.isArray(cmd.else)) walk(cmd.else);
                }
                if (cmd.type === 'while' && Array.isArray(cmd.body)) {
                    walk(cmd.body);
                }
                if (cmd.type === 'for' && Array.isArray(cmd.body)) {
                    walk(cmd.body);
                }
                if (cmd.type === 'choice' && Array.isArray(cmd.options)) {
                    for (const option of cmd.options) {
                        if (Array.isArray(option.commands)) walk(option.commands);
                    }
                }
            }
        };

        walk(script);
        return { audio, textures };
    }

    public extractAssetUrls(script: Script): { audio: Set<string>; textures: Set<string>; } {
        return AssetManager.extractAssetUrls(script);
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

    public async preloadSceneAssets(script: Script): Promise<void> {
        const { audio, textures } = this.extractAssetUrls(script);

        const texturePromises = [...textures].map((url) => this.preloadTexture(url));
        const audioPromises = [...audio].map((url) => this.preloadAudio(url));

        await Promise.all([...texturePromises, ...audioPromises]);
        this.logger.info(`Preloaded ${textures.size} textures, ${audio.size} audio files.`);
    }

    public setResolver(resolver: AssetResolver) {
        this.resolver = resolver;
    }

    private async preloadAudio(url: string): Promise<void> {
        const resolvedUrl = this.resolver(url);
        const key = `audio:${resolvedUrl}`;
        if (this.loadedUrls.has(key) || sound.exists(resolvedUrl)) {
            this.loadedUrls.add(key);
            return;
        }

        await new Promise<void>((resolve) => {
            sound.add(resolvedUrl, {
                loaded: (error) => {
                    if (error) this.logger.warn(`Failed to preload audio: ${url}`, error);
                    else this.loadedUrls.add(key);
                    resolve();
                },
                preload: true,
                url: resolvedUrl,
            });
        });
    }

    private async preloadSpritesheet(config: SpritesheetConfig): Promise<void> {
        const resolvedAtlasUrl = this.resolver(config.atlasUrl);
        const key = `sheet:${resolvedAtlasUrl}`;
        if (this.loadedUrls.has(key)) return;

        try {
            await this.spritesheets.load(config);
            this.loadedUrls.add(key);
        } catch (error) {
            this.logger.warn(`Failed to preload spritesheet: ${config.atlasUrl}`, error);
        }
    }

    private async preloadTexture(url: string): Promise<void> {
        const resolvedUrl = this.resolver(url);
        const key = `texture:${resolvedUrl}`;
        if (this.loadedUrls.has(key)) return;

        try {
            await Assets.load(resolvedUrl);
            this.loadedUrls.add(key);
        } catch (error) {
            this.logger.warn(`Failed to preload texture: ${url}`, error);
        }
    }
}


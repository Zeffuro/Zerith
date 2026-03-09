import { sound } from '@pixi/sound';
import { Assets } from 'pixi.js';

import type { AssetResolver } from '../Engine';
import type { BackgroundCommand } from '../handlers/BackgroundHandler';
import type { BgmCommand } from '../handlers/BgmHandler';
import type { BlockCommand } from '../handlers/BlockHandler';
import type { ForCommand } from '../handlers/ForHandler';
import type { IfCommand } from '../handlers/IfHandler';
import type { SfxCommand } from '../handlers/SfxHandler';
import type { SpriteCommand } from '../handlers/SpriteHandler';
import type { WhileCommand } from '../handlers/WhileHandler';
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

        const walk = (cmds: BaseCommand[]) => {
            for (const cmd of cmds) {
                if (cmd.type === 'background') {
                    const bgCmd = cmd as BackgroundCommand;
                    if (bgCmd.assetUrl) textures.add(bgCmd.assetUrl);
                }
                if (cmd.type === 'sfx') {
                    const sfxCmd = cmd as SfxCommand;
                    if (sfxCmd.assetUrl) audio.add(sfxCmd.assetUrl);
                }
                if (cmd.type === 'bgm') {
                    const bgmCmd = cmd as BgmCommand;
                    if (bgmCmd.assetUrl) audio.add(bgmCmd.assetUrl);
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

    public extractAssetUrls(script: Script): { audio: Set<string>; textures: Set<string>; } {
        return AssetManager.extractAssetUrls(script);
    }

    public async load<T = unknown>(url: string): Promise<T> {
        return await Assets.load<T>(this.resolve(url));
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

    public resolve(url: string): string {
        return this.resolver(url);
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

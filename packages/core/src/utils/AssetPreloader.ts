import { Assets } from 'pixi.js';
import { sound } from '@pixi/sound';
import type { BaseCommand, Script } from '../types';
import { Logger } from './Logger';

const logger = new Logger('[AssetPreloader]');

export function extractAssetUrls(script: Script): { textures: Set<string>; audio: Set<string> } {
    const textures = new Set<string>();
    const audio = new Set<string>();

    function walk(commands: BaseCommand[]) {
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
            if (cmd.type === 'choice' && Array.isArray(cmd.options)) {
                for (const option of cmd.options) {
                    if (Array.isArray(option.commands)) walk(option.commands);
                }
            }
        }
    }

    walk(script);
    return { textures, audio };
}

export async function preloadSceneAssets(script: Script): Promise<void> {
    const { textures, audio } = extractAssetUrls(script);

    const texturePromises = [...textures].map(url =>
        engine.loadAsset(url).catch(err => {
            logger.warn(`Failed to preload texture: ${url}`, err);
        })
    );

    const audioPromises = [...audio].map(url => {
        if (sound.exists(url)) return Promise.resolve();
        return new Promise<void>((resolve) => {
            sound.add(url, {
                url,
                preload: true,
                loaded: (err) => {
                    if (err) logger.warn(`Failed to preload audio: ${url}`, err);
                    resolve();
                }
            });
        });
    });

    await Promise.all([...texturePromises, ...audioPromises]);
    logger.info(`Preloaded ${textures.size} textures, ${audio.size} audio files.`);
}
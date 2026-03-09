import { sound } from '@pixi/sound';

import type { IAssetManager, IAudioManager } from '../interfaces/managers';
import type { BaseCommand, CommandHandler } from '../types';
import type { Logger } from '../utils/Logger';

export interface SfxCommand extends BaseCommand {
    assetUrl: string;
    type: 'sfx';
    volume?: number;
}

export class SfxHandler implements CommandHandler<SfxCommand> {
    public autoNext = true;
    public type = 'sfx' as const;
    private readonly assets: IAssetManager;
    private readonly audio: IAudioManager;
    private readonly logger: Logger;

    constructor(
        assets: IAssetManager,
        audio: IAudioManager,
        logger: Logger,
    ) {
        this.assets = assets;
        this.audio = audio;
        this.logger = logger;
    }

    execute = async (command: SfxCommand) => {
        const url = command.assetUrl;
        if (!url) return;

        const resolvedUrl = this.assets.resolve(url);

        try {
            if (!sound.exists(resolvedUrl)) {
                await new Promise((resolve, reject) => {
                    sound.add(resolvedUrl, {
                        loaded: (error, snd) => error ? reject(error) : resolve(snd),
                        preload: true,
                        url: resolvedUrl
                    });
                });
            }

            await sound.play(resolvedUrl, {
                volume: (command.volume ?? 0.8) * this.audio.sfxVolume,
            });

            this.logger.info(`Played SFX: ${url}`);
        } catch (error) {
            this.logger.error(`Failed to load/play SFX: ${url}`, error);
        }
    };
}
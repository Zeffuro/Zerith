// packages/core/src/handlers/SfxHandler.ts
import { sound } from '@pixi/sound';
import type { BaseCommand, CommandHandler } from '../types';
import type { Engine } from '../Engine';

export interface SfxCommand extends BaseCommand {
    type: 'sfx';
    assetUrl: string;
    volume?: number;
}

export class SfxHandler implements CommandHandler<SfxCommand> {
    public type = 'sfx';
    public autoNext = true;

    execute = async (command: SfxCommand, engine: Engine) => {
        const url = command.assetUrl;
        if (!url) return;

        const resolvedUrl = engine.assetResolver(url);

        try {
            if (!sound.exists(resolvedUrl)) {
                await new Promise((resolve, reject) => {
                    sound.add(resolvedUrl, {
                        url: resolvedUrl,
                        preload: true,
                        loaded: (err, snd) => err ? reject(err) : resolve(snd)
                    });
                });
            }

            sound.play(resolvedUrl, {
                volume: (command.volume ?? 0.8) * engine.audio.sfxVolume,
            });

            engine.logger.info(`Played SFX: ${url}`);
        } catch (error) {
            engine.logger.error(`Failed to load/play SFX: ${url}`, error);
        }
    };
}
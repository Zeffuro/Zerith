// packages/core/src/handlers/SfxHandler.ts
import { sound } from '@pixi/sound';

import type { AudioPlaybackContext } from '../execution/ExecutionContext';
import type { BaseCommand, CommandHandler } from '../types';

export interface SfxCommand extends BaseCommand {
    assetUrl: string;
    type: 'sfx';
    volume?: number;
}

export class SfxHandler implements CommandHandler<SfxCommand, AudioPlaybackContext> {
    public autoNext = true;
    public type = 'sfx' as const;

    execute = async (command: SfxCommand, engine: AudioPlaybackContext) => {
        const audio = engine.getSystem('audio');
        const url = command.assetUrl;
        if (!url) return;

        const resolvedUrl = engine.assetResolver(url);

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
                volume: (command.volume ?? 0.8) * audio.sfxVolume,
            });

            engine.logger.info(`Played SFX: ${url}`);
        } catch (error) {
            engine.logger.error(`Failed to load/play SFX: ${url}`, error);
        }
    };
}
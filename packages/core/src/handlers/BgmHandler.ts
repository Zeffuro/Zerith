import { sound } from '@pixi/sound';
import type { BaseCommand, CommandHandler } from '../types';
import type { Engine } from '../Engine';

export interface BgmCommand extends BaseCommand {
    type: 'bgm';
    action: 'play' | 'stop' | 'pause' | 'resume';
    assetUrl?: string;
    volume?: number;
    loop?: boolean;
}

export class BgmHandler implements CommandHandler<BgmCommand> {
    public type = 'bgm';
    public autoNext = true;
    private currentBgmUrl: string | null = null;
    private isPaused = false;

    execute = async (command: BgmCommand, engine: Engine) => {
        if (command.action === 'stop') {
            if (this.currentBgmUrl) {
                sound.stop(this.currentBgmUrl);
                engine.logger.info('BGM stopped.');
            }
            this.currentBgmUrl = null;
            this.isPaused = false;
            return;
        }

        if (command.action === 'pause') {
            if (this.currentBgmUrl) {
                sound.pause(this.currentBgmUrl);
                this.isPaused = true;
                engine.logger.info('BGM paused.');
            }
            return;
        }

        if (command.action === 'resume') {
            if (!this.currentBgmUrl) {
                engine.logger.warn('Tried to resume BGM, but no track is active.');
                return;
            }

            if (this.isPaused) {
                sound.resume(this.currentBgmUrl);
                this.isPaused = false;
                engine.logger.info(`BGM resumed: ${this.currentBgmUrl}`);
            } else {
                engine.logger.warn('BGM is not paused, nothing to resume.');
            }
            return;
        }

        if (command.action === 'play') {
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

                if (this.currentBgmUrl && this.currentBgmUrl !== resolvedUrl) {
                    sound.stop(this.currentBgmUrl);
                }

                this.currentBgmUrl = resolvedUrl;
                this.isPaused = false;

                sound.play(resolvedUrl, {
                    loop: command.loop ?? true,
                    volume: (command.volume ?? 0.5) * engine.audio.bgmVolume,
                    singleInstance: true
                });
                engine.setState('__sys_bgm', url);

                engine.logger.info(`Playing BGM: ${url}`);
            } catch (error) {
                engine.logger.error(`Failed to load/play BGM: ${url}`, error);
            }
        }
    };
}
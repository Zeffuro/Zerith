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
    private lastBgmUrl: string | null = null;

    execute = async (command: BgmCommand, engine: Engine) => {
        if (command.action === 'stop') {
            if (this.currentBgmUrl) {
                sound.stop(this.currentBgmUrl);
                this.lastBgmUrl = this.currentBgmUrl;
                this.currentBgmUrl = null;
                engine.logger.info('BGM stopped.');
            }
            return;
        }

        if (command.action === 'pause') {
            if (this.currentBgmUrl) {
                sound.pause(this.currentBgmUrl);
                engine.logger.info('BGM paused.');
            }
            return;
        }

        if (command.action === 'resume') {
            const targetUrl = this.currentBgmUrl || this.lastBgmUrl;
            if (targetUrl) {
                sound.resume(targetUrl);

                if (!this.currentBgmUrl) {
                    sound.play(targetUrl, {
                        loop: command.loop ?? true,
                        volume: (command.volume ?? 0.5) * engine.audio.bgmVolume,
                        singleInstance: true
                    });
                }
                this.currentBgmUrl = targetUrl;
                engine.logger.info(`BGM resumed: ${targetUrl}`);
            } else {
                engine.logger.warn('Tried to resume BGM, but no previous track was found.');
            }
            return;
        }

        if (command.action === 'play') {
            const url = command.assetUrl;
            if (!url) return;

            try {
                if (!sound.exists(url)) {
                    await new Promise((resolve, reject) => {
                        sound.add(url, {
                            url: url,
                            preload: true,
                            loaded: (err, snd) => err ? reject(err) : resolve(snd)
                        });
                    });
                }

                if (this.currentBgmUrl && this.currentBgmUrl !== url) {
                    sound.stop(this.currentBgmUrl);
                }

                this.currentBgmUrl = url;
                this.lastBgmUrl = url;

                sound.play(url, {
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
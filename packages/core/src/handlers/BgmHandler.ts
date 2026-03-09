import { sound } from '@pixi/sound';

import type { BgmPlaybackContext } from '../execution/ExecutionContext';
import type { SaveState } from '../managers/SaveManager';
import type { BaseCommand, CommandHandler } from '../types';

export interface BgmCommand extends BaseCommand {
    action: 'pause' | 'play' | 'resume' | 'stop';
    assetUrl?: string;
    loop?: boolean;
    type: 'bgm';
    volume?: number;
}

export class BgmHandler implements CommandHandler<BgmCommand, BgmPlaybackContext> {
    public autoNext = true;
    public type = 'bgm' as const;
    private context: BgmPlaybackContext | undefined;
    private currentBgmUrl: string | undefined;
    private isPaused = false;
    public destroy() {
        if (this.context) {
            this.context.getSystem('events').off('state:loaded', this.handleStateLoaded);
        }
    }

    execute = async (command: BgmCommand, engine: BgmPlaybackContext) => {
        const audio = engine.getSystem('audio');
        const state = engine.getSystem('state');
        if (command.action === 'stop') {
            if (this.currentBgmUrl) {
                sound.stop(this.currentBgmUrl);
                engine.logger.info('BGM stopped.');
            }
            this.currentBgmUrl = undefined;
            this.isPaused = false;
            state.system.bgm = undefined;
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
                            loaded: (error, snd) => error ? reject(error) : resolve(snd),
                            preload: true,
                            url: resolvedUrl
                        });
                    });
                }

                if (this.currentBgmUrl && this.currentBgmUrl !== resolvedUrl) {
                    sound.stop(this.currentBgmUrl);
                }

                this.currentBgmUrl = resolvedUrl;
                this.isPaused = false;

                await sound.play(resolvedUrl, {
                    loop: command.loop ?? true,
                    singleInstance: true,
                    volume: (command.volume ?? 0.5) * audio.bgmVolume
                });
                state.system.bgm = url;

                engine.logger.info(`Playing BGM: ${url}`);
            } catch (error) {
                engine.logger.error(`Failed to load/play BGM: ${url}`, error);
            }
        }
    };

    public init(context: BgmPlaybackContext) {
        this.context = context;
        context.getSystem('events').on('state:loaded', this.handleStateLoaded);
    }

    private readonly handleStateLoaded = (...arguments_: unknown[]) => {
        const saveData = arguments_[0] as SaveState;
        if (!this.context || !saveData.system.bgm) return;
        void this.execute({ action: 'play', assetUrl: saveData.system.bgm, type: 'bgm' }, this.context);
    };
}
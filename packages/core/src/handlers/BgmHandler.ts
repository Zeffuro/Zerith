import { sound } from '@pixi/sound';

import type { IAssetManager, IAudioManager, IEventBus, IStateManager } from '../interfaces/managers';
import type { SaveState } from '../managers/SaveManager';
import type { BaseCommand, CommandHandler } from '../types';
import type { Logger } from '../utils/Logger';

export interface BgmCommand extends BaseCommand {
    action: 'pause' | 'play' | 'resume' | 'stop';
    assetUrl?: string;
    loop?: boolean;
    type: 'bgm';
    volume?: number;
}

export class BgmHandler implements CommandHandler<BgmCommand> {
    public autoNext = true;
    public type = 'bgm' as const;
    private readonly assets: IAssetManager;
    private readonly audio: IAudioManager;
    private currentBgmUrl: string | undefined;
    private readonly events: IEventBus;
    private isPaused = false;
    private readonly logger: Logger;
    private readonly state: IStateManager;

    constructor(
        assets: IAssetManager,
        audio: IAudioManager,
        logger: Logger,
        state: IStateManager,
        events: IEventBus,
    ) {
        this.assets = assets;
        this.audio = audio;
        this.logger = logger;
        this.state = state;
        this.events = events;
        this.events.on('state:loaded', this.handleStateLoaded);
    }

    public destroy() {
        this.events.off('state:loaded', this.handleStateLoaded);
    }

    execute = async (command: BgmCommand) => {
        if (command.action === 'stop') {
            if (this.currentBgmUrl) {
                sound.stop(this.currentBgmUrl);
                this.logger.info('BGM stopped.');
            }
            this.currentBgmUrl = undefined;
            this.isPaused = false;
            this.state.system.bgm = undefined;
            return;
        }

        if (command.action === 'pause') {
            if (this.currentBgmUrl) {
                sound.pause(this.currentBgmUrl);
                this.isPaused = true;
                this.logger.info('BGM paused.');
            }
            return;
        }

        if (command.action === 'resume') {
            if (!this.currentBgmUrl) {
                this.logger.warn('Tried to resume BGM, but no track is active.');
                return;
            }

            if (this.isPaused) {
                sound.resume(this.currentBgmUrl);
                this.isPaused = false;
                this.logger.info(`BGM resumed: ${this.currentBgmUrl}`);
            } else {
                this.logger.warn('BGM is not paused, nothing to resume.');
            }
            return;
        }

        if (command.action === 'play') {
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

                if (this.currentBgmUrl && this.currentBgmUrl !== resolvedUrl) {
                    sound.stop(this.currentBgmUrl);
                }

                this.currentBgmUrl = resolvedUrl;
                this.isPaused = false;

                await sound.play(resolvedUrl, {
                    loop: command.loop ?? true,
                    singleInstance: true,
                    volume: (command.volume ?? 0.5) * this.audio.bgmVolume
                });
                this.state.system.bgm = url;

                this.logger.info(`Playing BGM: ${url}`);
            } catch (error) {
                this.logger.error(`Failed to load/play BGM: ${url}`, error);
            }
        }
    };

    private readonly handleStateLoaded = (...arguments_: unknown[]) => {
        const saveData = arguments_[0] as SaveState;
        if (!saveData.system.bgm) return;
        void this.execute({ action: 'play', assetUrl: saveData.system.bgm, type: 'bgm' });
    };
}
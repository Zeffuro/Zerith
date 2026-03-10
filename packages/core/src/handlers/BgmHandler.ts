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
            if (this.audio.currentBgmUrl) {
                this.audio.stopBgm();
                this.logger.info('BGM stopped.');
            }
            this.isPaused = false;
            this.state.system.bgm = undefined;
            return;
        }

        if (command.action === 'pause') {
            if (this.audio.currentBgmUrl) {
                this.audio.pauseBgm();
                this.isPaused = true;
                this.logger.info('BGM paused.');
            }
            return;
        }

        if (command.action === 'resume') {
            if (!this.audio.currentBgmUrl) {
                this.logger.warn('Tried to resume BGM, but no track is active.');
                return;
            }

            if (this.isPaused) {
                this.audio.resumeBgm();
                this.isPaused = false;
                this.logger.info(`BGM resumed: ${this.audio.currentBgmUrl}`);
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
                if (!this.audio.audioExists(resolvedUrl)) {
                    await this.audio.preloadAudio(resolvedUrl);
                }

                if (this.audio.currentBgmUrl && this.audio.currentBgmUrl !== resolvedUrl) {
                    this.audio.stopBgm();
                }

                this.isPaused = false;

                await this.audio.playBgm(resolvedUrl, command.loop ?? true, command.volume ?? 0.5);
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
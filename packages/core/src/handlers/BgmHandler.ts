import type { IAssetManager, IAudioManager, IEventBus, IStateManager } from '../interfaces/managers';
import type { SaveState } from '../managers/SaveManager';
import type { BaseCommand, CommandHandler } from '../types';
import type { Logger } from '../utils/Logger';

import { parseAudiosheetDescriptor } from '../schemas';

export interface BgmCommand extends BaseCommand {
    action: 'pause' | 'play' | 'resume' | 'stop';
    assetUrl?: string;
    loop?: boolean;
    type: 'bgm';
    volume?: number;
}

type CueReference = {
    cueName: string;
    sheetUrl: string;
};


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
        this.reset();
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

            try {
                const cueReference = this.parseCueReference(url);
                this.isPaused = false;

                if (cueReference) {
                    await this.playCue(cueReference, command);
                } else {
                    const resolvedUrl = await this.assets.resolve(url);

                    if (!this.audio.audioExists(resolvedUrl)) {
                        await this.audio.preloadAudio(resolvedUrl);
                    }

                    if (this.audio.currentBgmUrl && this.audio.currentBgmUrl !== resolvedUrl) {
                        this.audio.stopBgm();
                    }

                    await this.audio.playBgm(resolvedUrl, command.loop ?? true, command.volume ?? 0.5);
                }

                this.state.system.bgm = url;

                this.logger.info(`Playing BGM: ${url}`);
            } catch (error) {
                this.logger.error(`Failed to load/play BGM: ${url}`, error);
            }
        }
    };

    public reset(): void {
        this.isPaused = false;
    }

    private readonly handleStateLoaded = (...arguments_: unknown[]) => {
        const saveData = arguments_[0] as SaveState;
        if (!saveData.system.bgm) return;
        void this.execute({ action: 'play', assetUrl: saveData.system.bgm, type: 'bgm' });
    };

    private parseCueReference(assetUrl: string): CueReference | undefined {
        if (!assetUrl.includes(':') || isHttpUrl(assetUrl)) {
            return undefined;
        }

        const separatorIndex = assetUrl.lastIndexOf(':');
        if (separatorIndex <= 0 || separatorIndex >= assetUrl.length - 1) {
            return undefined;
        }

        const sheetUrl = assetUrl.slice(0, separatorIndex);
        const cueName = assetUrl.slice(separatorIndex + 1);

        if (sheetUrl.length === 0 || cueName.length === 0) {
            return undefined;
        }

        return { cueName, sheetUrl };
    }

    private async playCue(cueReference: CueReference, command: BgmCommand): Promise<void> {
        const descriptorData = await this.assets.load<unknown>(cueReference.sheetUrl);
        const parsedDescriptor = parseAudiosheetDescriptor(descriptorData);

        if (!parsedDescriptor.success) {
            throw new Error(`Invalid audiosheet descriptor '${cueReference.sheetUrl}': ${parsedDescriptor.error}`);
        }

        const sourceAssetUrl = resolveSheetSource(cueReference.sheetUrl, parsedDescriptor.data.source);

        await this.audio.loadAudiosheet(cueReference.sheetUrl, {
            ...parsedDescriptor.data,
            source: await this.assets.resolve(sourceAssetUrl),
        });
        await this.audio.playCue(cueReference.sheetUrl, cueReference.cueName, {
            channel: 'bgm',
            loop: command.loop,
            volume: command.volume ?? 0.5,
        });
    }
}

function isHttpUrl(assetUrl: string): boolean {
    return /^[a-z][a-z+.-]*:\/\//i.test(assetUrl);
}

function resolveSheetSource(sheetUrl: string, source: string): string {
    if (source.startsWith('/') || isHttpUrl(source)) {
        return source;
    }

    const directory = sheetUrl.slice(0, Math.max(0, sheetUrl.lastIndexOf('/') + 1));
    return `${directory}${source}`;
}


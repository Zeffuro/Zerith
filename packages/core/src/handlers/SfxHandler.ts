import type { IAssetManager, IAudioManager } from '../interfaces/managers';
import type { BaseCommand, CommandHandler } from '../types';
import type { Logger } from '../utils/Logger';

import { parseAudiosheetDescriptor } from '../schemas';

export interface SfxCommand extends BaseCommand {
    assetUrl: string;
    type: 'sfx';
    volume?: number;
}

type CueReference = {
    cueName: string;
    sheetUrl: string;
};

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

        const cueReference = this.parseCueReference(url);

        try {
            if (cueReference) {
                await this.playCue(cueReference, command.volume ?? 0.8);
                this.logger.info(`Played SFX cue: ${url}`);
                return;
            }

            const resolvedUrl = await this.assets.resolve(url);
            await this.audio.playSfx(resolvedUrl, command.volume ?? 0.8);
            this.logger.info(`Played SFX: ${url}`);
        } catch (error) {
            this.logger.error(`Failed to load/play SFX: ${url}`, error);
        }
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

    private async playCue(cueReference: CueReference, commandVolume: number): Promise<void> {
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
        await this.audio.playCue(cueReference.sheetUrl, cueReference.cueName, { volume: commandVolume });
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


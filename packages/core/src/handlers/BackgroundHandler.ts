import { Sprite, Texture } from 'pixi.js';

import type { IAssetManager, IDisplayManager, IEventBus, IStateManager } from '../interfaces/managers';
import type { SaveState } from '../managers/SaveManager';
import type { BaseCommand, CommandHandler } from '../types';

import { Logger } from '../utils/Logger';

export interface BackgroundCommand extends BaseCommand {
    assetUrl: string;
    type: 'background';
}

export class BackgroundHandler implements CommandHandler<BackgroundCommand> {
    public autoNext = true;
    public type = 'background' as const;
    private readonly assets: IAssetManager;
    private destroyed = false;
    private readonly display: IDisplayManager;
    private readonly events: IEventBus;
    private loadSequence = 0;
    private readonly logger = new Logger('[BackgroundHandler]');
    private sprite: Sprite | undefined;
    private readonly state: IStateManager;

    constructor(
        assets: IAssetManager,
        display: IDisplayManager,
        state: IStateManager,
        events: IEventBus,
    ) {
        this.assets = assets;
        this.display = display;
        this.state = state;
        this.events = events;
        this.events.on('state:loaded', this.handleStateLoaded);
    }

    public destroy() {
        this.destroyed = true;
        this.events.off('state:loaded', this.handleStateLoaded);
        this.reset();
    }

    execute = async (command: BackgroundCommand) => {
        if (this.destroyed) return;
        const sequence = ++this.loadSequence;
        const { assetUrl } = command;
        let texture: Texture | undefined;
        try {
            texture = await this.assets.load<Texture>(assetUrl);
        } catch (error) {
            if (!this.isCurrent(sequence)) return;
            throw error;
        }
        if (!this.isCurrent(sequence)) return;
        if (!texture) {
            throw new Error(`Failed to load background texture: ${assetUrl}`);
        }

        if (this.sprite) {
            this.sprite.texture = texture;
            this.sprite.width = this.display.width;
            this.sprite.height = this.display.height;
        } else {
            this.sprite = new Sprite(texture);
            this.sprite.width = this.display.width;
            this.sprite.height = this.display.height;
            this.display.getLayer('background').addChild(this.sprite);
        }

        this.state.system.background = assetUrl;
    };

    public reset(): void {
        this.loadSequence += 1;
        this.sprite?.removeFromParent();
        this.sprite?.destroy();
        this.sprite = undefined;
    }

    private readonly handleStateLoaded = (saveData: SaveState) => {
        this.reset();
        if (!saveData.system.background) return;
        const loading = this.execute({ assetUrl: saveData.system.background, type: 'background' });
        const sequence = this.loadSequence;
        void loading.catch(error => {
            if (this.isCurrent(sequence)) this.logger.error('Failed to restore background.', error);
        });
    };

    private isCurrent(sequence: number): boolean {
        return !this.destroyed && sequence === this.loadSequence;
    }
}

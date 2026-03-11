import { Sprite, Texture } from 'pixi.js';

import type { IAssetManager, IDisplayManager, IEventBus, IStateManager } from '../interfaces/managers';
import type { SaveState } from '../managers/SaveManager';
import type { BaseCommand, CommandHandler } from '../types';

export interface BackgroundCommand extends BaseCommand {
    assetUrl: string;
    type: 'background';
}

export class BackgroundHandler implements CommandHandler<BackgroundCommand> {
    public autoNext = true;
    public type = 'background' as const;
    private readonly assets: IAssetManager;
    private readonly display: IDisplayManager;
    private readonly events: IEventBus;
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
        this.events.off('state:loaded', this.handleStateLoaded);
        this.reset();
    }

    execute = async (command: BackgroundCommand) => {
        const texture = await this.assets.load<Texture>(command.assetUrl);

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

        this.state.system.background = command.assetUrl;
    };

    public reset(): void {
        this.sprite?.removeFromParent();
        this.sprite?.destroy();
        this.sprite = undefined;
    }

    private readonly handleStateLoaded = (...arguments_: unknown[]) => {
        const saveData = arguments_[0] as SaveState;
        if (!saveData.system.background) return;
        void this.execute({ assetUrl: saveData.system.background, type: 'background' });
    };
}
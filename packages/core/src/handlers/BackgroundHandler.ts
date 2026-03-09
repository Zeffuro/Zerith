import { Sprite, Texture } from 'pixi.js';

import type { StatefulVisualContext } from '../execution/ExecutionContext';
import type { SaveState } from '../managers/SaveManager';
import type { BaseCommand, CommandHandler } from '../types';

export interface BackgroundCommand extends BaseCommand {
    assetUrl: string;
    type: 'background';
}

export class BackgroundHandler implements CommandHandler<BackgroundCommand, StatefulVisualContext> {
    public autoNext = true;
    public type = 'background' as const;
    private context: StatefulVisualContext | undefined;
    private sprite: Sprite | undefined;
    public destroy() {
        if (this.context) {
            this.context.getSystem('events').off('state:loaded', this.handleStateLoaded);
        }
    }

    execute = async (command: BackgroundCommand, engine: StatefulVisualContext) => {
        const display = engine.getSystem('display');
        const state = engine.getSystem('state');
        const texture = await engine.loadAsset<Texture>(command.assetUrl);

        if (this.sprite) {
            this.sprite.texture = texture;
            this.sprite.width = display.width;
            this.sprite.height = display.height;
        } else {
            this.sprite = new Sprite(texture);
            this.sprite.width = display.width;
            this.sprite.height = display.height;
            engine.getLayer('background').addChild(this.sprite);
        }

        state.system.background = command.assetUrl;
    };

    public init(context: StatefulVisualContext) {
        this.context = context;
        context.getSystem('events').on('state:loaded', this.handleStateLoaded);
    }

    private readonly handleStateLoaded = (...arguments_: unknown[]) => {
        const saveData = arguments_[0] as SaveState;
        if (!this.context || !saveData.system.background) return;
        void this.execute({ assetUrl: saveData.system.background, type: 'background' }, this.context);
    };
}
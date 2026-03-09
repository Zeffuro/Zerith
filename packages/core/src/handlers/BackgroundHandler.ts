import { Sprite, Texture } from 'pixi.js';

import type { Engine } from '../Engine';
import type { BaseCommand, CommandHandler } from '../types';

export interface BackgroundCommand extends BaseCommand {
    assetUrl: string;
    type: 'background';
}

export class BackgroundHandler implements CommandHandler<BackgroundCommand> {
    public autoNext = true;
    public type = 'background' as const;
    private sprite: Sprite | undefined;

    execute = async (command: BackgroundCommand, engine: Engine) => {
        const texture = await engine.loadAsset<Texture>(command.assetUrl);

        if (this.sprite) {
            this.sprite.texture = texture;
            this.sprite.width = engine.display.width;
            this.sprite.height = engine.display.height;
        } else {
            this.sprite = new Sprite(texture);
            this.sprite.width = engine.display.width;
            this.sprite.height = engine.display.height;
            engine.layers.background.addChild(this.sprite);
        }

        engine.setState('__sys_bg', command.assetUrl);
    };
}
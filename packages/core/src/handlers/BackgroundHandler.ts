import { Assets, Sprite } from 'pixi.js';
import type { BaseCommand, CommandHandler } from '../types';
import type { Engine } from '../Engine';

export interface BackgroundCommand extends BaseCommand {
    type: 'background';
    assetUrl: string;
}

export class BackgroundHandler implements CommandHandler<BackgroundCommand> {
    public type = 'background';
    public autoNext = true;
    private sprite: Sprite | null = null;

    execute = async (command: BackgroundCommand, engine: Engine) => {
        const texture = await Assets.load(command.assetUrl);

        if (!this.sprite) {
            this.sprite = new Sprite(texture);
            this.sprite.anchor.set(0.5);
            engine.layers.background.addChild(this.sprite);
        } else {
            this.sprite.texture = texture;
        }

        this.sprite.x = engine.app.screen.width / 2;
        this.sprite.y = engine.app.screen.height / 2;

        const screenAspect = engine.app.screen.width / engine.app.screen.height;
        const textureAspect = texture.width / texture.height;

        if (textureAspect > screenAspect) {
            this.sprite.height = engine.app.screen.height;
            this.sprite.scale.x = this.sprite.scale.y;
        } else {
            this.sprite.width = engine.app.screen.width;
            this.sprite.scale.y = this.sprite.scale.x;
        }
        engine.setState('__sys_bg', command.assetUrl);
    };
}
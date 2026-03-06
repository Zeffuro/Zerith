import { Sprite } from 'pixi.js';
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
        const texture = await engine.loadAsset(command.assetUrl);

        if (!this.sprite) {
            this.sprite = new Sprite(texture);
            this.sprite.anchor.set(0.5);
            engine.layers.background.addChild(this.sprite);
        } else {
            this.sprite.texture = texture;
        }

        const w = engine.display.width;
        const h = engine.display.height;

        this.sprite.x = w / 2;
        this.sprite.y = h / 2;

        const screenAspect = w / h;
        const textureAspect = texture.width / texture.height;

        if (textureAspect > screenAspect) {
            this.sprite.height = h;
            this.sprite.scale.x = this.sprite.scale.y;
        } else {
            this.sprite.width = w;
            this.sprite.scale.y = this.sprite.scale.x;
        }
        engine.setState('__sys_bg', command.assetUrl);
    };
}
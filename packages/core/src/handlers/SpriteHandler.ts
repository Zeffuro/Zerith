import {Assets, Sprite} from 'pixi.js';
import type {BaseCommand, CommandHandler} from '../types';
import type {Engine} from '../Engine';

export interface SpriteCommand extends BaseCommand {
    type: 'sprite';
    id: string;
    action: 'show' | 'hide' | 'move' | 'pose';
    assetUrl?: string;
    x?: number;
    y?: number;
    anchorX?: number;
    anchorY?: number;
    scaleX?: number;
    scaleY?: number;
    flip?: boolean;
    transition?: 'instant' | 'fade';
    duration?: number;
}

export class SpriteHandler implements CommandHandler<SpriteCommand> {
    public type = 'sprite';
    public autoNext = true;
    private sprites: Map<string, Sprite> = new Map();

    reset = () => {
        this.sprites.clear();
    };

    execute = async (command: SpriteCommand, engine: Engine) => {
        switch (command.action) {
            case 'show':
                await this.show(command, engine);
                break;
            case 'hide':
                await this.hide(command, engine);
                break;
            case 'move':
                await this.move(command, engine);
                break;
            case 'pose':
                await this.changePose(command, engine);
                break;
        }
    };

    private async show(command: SpriteCommand, engine: Engine) {
        if (!command.assetUrl) {
            engine.logger.warn(`Sprite 'show' requires assetUrl (id: '${command.id}')`);
            return;
        }

        const texture = await Assets.load(command.assetUrl);

        let sprite = this.sprites.get(command.id);
        if (!sprite) {
            sprite = new Sprite(texture);
            this.sprites.set(command.id, sprite);
            engine.layers.sprites.addChild(sprite);
        } else {
            sprite.texture = texture;
        }

        sprite.anchor.set(command.anchorX ?? 0.5, command.anchorY ?? 1);
        sprite.position.set(
            command.x ?? engine.display.width / 2,
            command.y ?? engine.display.height
        );

        if (command.scaleX !== undefined || command.scaleY !== undefined) {
            sprite.scale.set(
                command.scaleX ?? sprite.scale.x,
                command.scaleY ?? sprite.scale.y
            );
        }

        if (command.flip) {
            sprite.scale.x = -Math.abs(sprite.scale.x);
        }

        if (command.transition === 'fade') {
            await this.fadeIn(sprite, command.duration ?? 300);
        } else {
            sprite.alpha = 1;
        }

        const sprites = engine.getState('__sys_sprites') ?? {};
        sprites[command.id] = {
            assetUrl: command.assetUrl,
            x: sprite.x,
            y: sprite.y,
            anchorX: command.anchorX ?? 0.5,
            anchorY: command.anchorY ?? 1,
            scaleX: sprite.scale.x,
            scaleY: sprite.scale.y,
            flip: command.flip ?? false,
        };
        engine.setState('__sys_sprites', sprites);
    }

    private async hide(command: SpriteCommand, engine: Engine) {
        const sprite = this.sprites.get(command.id);
        if (!sprite) return;

        if (command.transition === 'fade') {
            await this.fadeOut(sprite, command.duration ?? 300);
        }

        engine.layers.sprites.removeChild(sprite);
        sprite.destroy();
        this.sprites.delete(command.id);

        const sprites = engine.getState('__sys_sprites') ?? {};
        delete sprites[command.id];
        engine.setState('__sys_sprites', sprites);
    }

    private async move(command: SpriteCommand, engine: Engine) {
        const sprite = this.sprites.get(command.id);
        if (!sprite) {
            engine.logger.warn(`Sprite '${command.id}' not found for 'move'`);
            return;
        }

        const targetX = command.x ?? sprite.x;
        const targetY = command.y ?? sprite.y;
        const duration = command.duration ?? 300;

        if (duration <= 0 || command.transition === 'instant') {
            sprite.position.set(targetX, targetY);
            if (command.flip !== undefined) {
                sprite.scale.x = command.flip
                    ? -Math.abs(sprite.scale.x)
                    : Math.abs(sprite.scale.x);
            }
            return;
        }

        const startX = sprite.x;
        const startY = sprite.y;
        const startTime = performance.now();

        await new Promise<void>((resolve) => {
            const animate = (time: number) => {
                const progress = Math.min((time - startTime) / duration, 1);
                sprite!.position.set(
                    startX + (targetX - startX) * progress,
                    startY + (targetY - startY) * progress
                );

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    if (command.flip !== undefined) {
                        sprite!.scale.x = command.flip
                            ? -Math.abs(sprite!.scale.x)
                            : Math.abs(sprite!.scale.x);
                    }
                    resolve();
                }
            };
            requestAnimationFrame(animate);
        });

        const sprites = engine.getState('__sys_sprites') ?? {};
        if (sprites[command.id]) {
            sprites[command.id].x = sprite.x;
            sprites[command.id].y = sprite.y;
            engine.setState('__sys_sprites', sprites);
        }
    }

    private async changePose(command: SpriteCommand, engine: Engine) {
        if (!command.assetUrl) {
            engine.logger.warn(`Sprite 'pose' requires assetUrl (id: '${command.id}')`);
            return;
        }

        const sprite = this.sprites.get(command.id);
        if (!sprite) {
            engine.logger.warn(`Sprite '${command.id}' not found for 'pose'`);
            return;
        }

        sprite.texture = await Assets.load(command.assetUrl);

        if (command.flip !== undefined) {
            sprite.scale.x = command.flip
                ? -Math.abs(sprite.scale.x)
                : Math.abs(sprite.scale.x);
        }

        const sprites = engine.getState('__sys_sprites') ?? {};
        if (sprites[command.id]) {
            sprites[command.id].assetUrl = command.assetUrl;
            engine.setState('__sys_sprites', sprites);
        }
    }

    private fadeIn(sprite: Sprite, duration: number): Promise<void> {
        sprite.alpha = 0;
        const startTime = performance.now();

        return new Promise((resolve) => {
            const animate = (time: number) => {
                const progress = Math.min((time - startTime) / duration, 1);
                sprite.alpha = progress;
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };
            requestAnimationFrame(animate);
        });
    }

    private fadeOut(sprite: Sprite, duration: number): Promise<void> {
        const startTime = performance.now();

        return new Promise((resolve) => {
            const animate = (time: number) => {
                const progress = Math.min((time - startTime) / duration, 1);
                sprite.alpha = 1 - progress;
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };
            requestAnimationFrame(animate);
        });
    }
}
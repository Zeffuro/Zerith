import { Sprite, type Texture } from 'pixi.js';

import type { IAssetManager, IDisplayManager, IEventBus, ISpritesheetManager, IStateManager } from '../interfaces/managers';
import type { CommandHandler } from '../types';
import type { GameManifest } from '../types/GameManifest';
import type { Logger } from '../utils/Logger';
import type { SpriteCommand } from './sprite/types';

import { SpriteAnimator } from './sprite/SpriteAnimator';
import { SpriteStateSerializer } from './sprite/SpriteStateSerializer';
import { SpriteTextureResolver } from './sprite/SpriteTextureResolver';

export type { SpriteCommand, SpriteState } from './sprite/types';

export class SpriteHandler implements CommandHandler<SpriteCommand> {
    public autoNext = true;
    public type = 'sprite' as const;
    private readonly animator: SpriteAnimator;
    private readonly assets: IAssetManager;
    private readonly display: IDisplayManager;
    private readonly events: IEventBus;
    private readonly logger: Logger;
    private readonly serializer: SpriteStateSerializer;
    private sprites: Map<string, Sprite> = new Map();
    private readonly textureResolver: SpriteTextureResolver;

    constructor(
        assets: IAssetManager,
        display: IDisplayManager,
        events: IEventBus,
        logger: Logger,
        spritesheets: ISpritesheetManager,
        state: IStateManager,
        getManifest: () => GameManifest,
    ) {
        this.assets = assets;
        this.display = display;
        this.events = events;
        this.logger = logger;
        this.animator = new SpriteAnimator();
        this.textureResolver = new SpriteTextureResolver(assets, spritesheets, logger, getManifest);
        this.serializer = new SpriteStateSerializer(state, async (command) => {
            await this.execute(command);
        });
        this.events.on('state:loaded', this.serializer.handleStateLoaded);
    }

    public destroy() {
        this.events.off('state:loaded', this.serializer.handleStateLoaded);
        this.reset();
    }

    execute = async (command: SpriteCommand) => {
        switch (command.action) {
            case 'animate': {
                await this.animate(command);
                break;
            }
            case 'hide': {
                await this.hide(command);
                break;
            }
            case 'move': {
                await this.move(command);
                break;
            }
            case 'pose': {
                await this.changePose(command);
                break;
            }
            case 'show': {
                await this.show(command);
                break;
            }
        }
    };

    reset = () => {
        this.animator.stopAllAnimations();

        for (const sprite of this.sprites.values()) {
            sprite.removeFromParent();
            sprite.destroy();
        }
        this.sprites.clear();
    };

    private async animate(command: SpriteCommand) {
        if (!command.animation) {
            this.logger.warn(`Sprite 'animate' requires an animation name (id: '${command.id}')`);
            return;
        }

        const sprite = this.sprites.get(command.id);
        if (!sprite) {
            this.logger.warn(`Sprite '${command.id}' not found for 'animate'`);
            return;
        }

        const resolvedAnimation = await this.textureResolver.resolveAnimation(command.id, command.animation);
        if (!resolvedAnimation) {
            return;
        }

        await this.animator.runAnimation({
            id: command.id,
            loop: resolvedAnimation.loop,
            speed: resolvedAnimation.speed,
            sprite,
            textures: resolvedAnimation.textures,
            wait: Boolean(command.wait && !resolvedAnimation.loop),
        });

        this.serializer.saveAnimation(command.id, command.animation);
    }

    private async changePose(command: SpriteCommand) {
        this.animator.stopAnimation(command.id);

        const texture = await this.textureResolver.resolveTexture(command);
        if (!texture) {
            this.logger.warn(`Sprite 'pose' could not resolve texture (id: '${command.id}')`);
            return;
        }

        const sprite = this.sprites.get(command.id);
        if (!sprite) { this.logger.warn(`Sprite '${command.id}' not found for 'pose'`); return; }

        sprite.texture = texture;

        if (command.flip !== undefined) {
            sprite.scale.x = command.flip ? -Math.abs(sprite.scale.x) : Math.abs(sprite.scale.x);
        }

        this.serializer.savePose(command.id, command);
    }

    private fadeIn(sprite: Sprite, duration: number): Promise<void> {
        sprite.alpha = 0;
        const startTime = performance.now();
        return new Promise((resolve) => {
            const tick = (time: number) => {
                const p = Math.min((time - startTime) / duration, 1);
                sprite.alpha = p;
                if (p < 1) requestAnimationFrame(tick);
                else resolve();
            };
            requestAnimationFrame(tick);
        });
    }

    private fadeOut(sprite: Sprite, duration: number): Promise<void> {
        const startTime = performance.now();
        return new Promise((resolve) => {
            const tick = (time: number) => {
                const p = Math.min((time - startTime) / duration, 1);
                sprite.alpha = 1 - p;
                if (p < 1) requestAnimationFrame(tick);
                else resolve();
            };
            requestAnimationFrame(tick);
        });
    }

    private async hide(command: SpriteCommand) {
        this.animator.stopAnimation(command.id);

        const sprite = this.sprites.get(command.id);
        if (!sprite) return;

        if (command.transition === 'fade') await this.fadeOut(sprite, command.duration ?? 300);

        sprite.removeFromParent();
        sprite.destroy();
        this.sprites.delete(command.id);

        this.serializer.removeSprite(command.id);
    }

    private async move(command: SpriteCommand) {
        const sprite = this.sprites.get(command.id);
        if (!sprite) { this.logger.warn(`Sprite '${command.id}' not found for 'move'`); return; }

        const targetX = command.x ?? sprite.x;
        const targetY = command.y ?? sprite.y;
        const duration = command.duration ?? 300;

        if (duration <= 0 || command.transition === 'instant') {
            sprite.position.set(targetX, targetY);
            if (command.flip !== undefined) {
                sprite.scale.x = command.flip ? -Math.abs(sprite.scale.x) : Math.abs(sprite.scale.x);
            }
            return;
        }

        const startX = sprite.x, startY = sprite.y;
        const startTime = performance.now();

        await new Promise<void>((resolve) => {
            const tick = (time: number) => {
                const progress = Math.min((time - startTime) / duration, 1);
                sprite.position.set(
                    startX + (targetX - startX) * progress,
                    startY + (targetY - startY) * progress
                );
                if (progress < 1) { requestAnimationFrame(tick); }
                else {
                    if (command.flip !== undefined) {
                        sprite.scale.x = command.flip ? -Math.abs(sprite.scale.x) : Math.abs(sprite.scale.x);
                    }
                    resolve();
                }
            };
            requestAnimationFrame(tick);
        });

        this.serializer.saveMove(command.id, sprite.x, sprite.y);
    }

    private async show(command: SpriteCommand) {
        const texture = await this.textureResolver.resolveTexture(command);
        if (!texture) {
            if (command.assetUrl) {
                const fallback = await this.assets.load<Texture>(command.assetUrl);
                return this.showWithTexture(command, fallback);
            }
            this.logger.warn(`Sprite 'show' could not resolve texture (id: '${command.id}')`);
            return;
        }
        await this.showWithTexture(command, texture);
    }

    private async showWithTexture(command: SpriteCommand, texture: Texture) {
        let sprite = this.sprites.get(command.id);
        if (sprite) {
            sprite.texture = texture;
        } else {
            sprite = new Sprite(texture);
            this.sprites.set(command.id, sprite);
            this.display.getLayer('sprites').addChild(sprite);
        }

        const charData = this.textureResolver.findCharacter(command.id);
        const defaults = charData?.displayDefaults;

        sprite.anchor.set(
            command.anchorX ?? defaults?.anchorX ?? 0.5,
            command.anchorY ?? defaults?.anchorY ?? 1
        );
        sprite.position.set(
            command.x ?? defaults?.x ?? this.display.width / 2,
            command.y ?? defaults?.y ?? this.display.height
        );

        const sX = command.scaleX ?? defaults?.scaleX;
        const sY = command.scaleY ?? defaults?.scaleY;
        if (sX !== undefined || sY !== undefined) {
            sprite.scale.set(sX ?? sprite.scale.x, sY ?? sprite.scale.y);
        }

        if (command.flip ?? defaults?.flip) {
            sprite.scale.x = -Math.abs(sprite.scale.x);
        }

        if (command.transition === 'fade') {
            await this.fadeIn(sprite, command.duration ?? 300);
        } else {
            sprite.alpha = 1;
        }

        this.serializer.saveShownSprite(command.id, {
            anchorX: sprite.anchor.x,
            anchorY: sprite.anchor.y,
            assetUrl: command.assetUrl,
            flip: command.flip ?? defaults?.flip ?? false,
            pose: command.pose,
            scaleX: sprite.scale.x,
            scaleY: sprite.scale.y,
            x: sprite.x,
            y: sprite.y,
        });
    }
}

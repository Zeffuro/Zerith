import { Sprite, type Texture } from 'pixi.js';

import type { SpriteExecutionContext } from '../execution/ExecutionContext';
import type { SaveState } from '../managers/SaveManager';
import type { BaseCommand, CommandHandler } from '../types';
import type { CharacterDefinition } from '../types/Character';

export interface SpriteCommand extends BaseCommand {
    action: 'animate' | 'hide' | 'move' | 'pose' | 'show';
    anchorX?: number;
    anchorY?: number;
    animation?: string;
    assetUrl?: string;
    duration?: number;
    flip?: boolean;
    id: string;
    pose?: string;
    scaleX?: number;
    scaleY?: number;
    transition?: 'fade' | 'instant';
    type: 'sprite';
    wait?: boolean;
    x?: number;
    y?: number;
}

export interface SpriteState {
    alpha?: number;
    anchorX?: number;
    anchorY?: number;
    animation?: string;
    assetUrl?: string;
    flip?: boolean;
    pose?: string;
    scaleX?: number;
    scaleY?: number;
    x?: number;
    y?: number;
}

interface ActiveAnimation {
    frameId: number;
    running: boolean;
}

export class SpriteHandler implements CommandHandler<SpriteCommand, SpriteExecutionContext> {
    public autoNext = true;
    public type = 'sprite' as const;
    private activeAnimations: Map<string, ActiveAnimation> = new Map();
    private context: SpriteExecutionContext | undefined;
    private sprites: Map<string, Sprite> = new Map();
    public destroy() {
        if (this.context) {
            this.context.getSystem('events').off('state:loaded', this.handleStateLoaded);
        }
    }

    execute = async (command: SpriteCommand, engine: SpriteExecutionContext) => {
        switch (command.action) {
            case 'animate': { await this.animate(command, engine); break;
            }
            case 'hide': { await this.hide(command, engine); break;
            }
            case 'move': { await this.move(command, engine); break;
            }
            case 'pose': { await this.changePose(command, engine); break;
            }
            case 'show': { await this.show(command, engine); break;
            }
        }
    };

    public init(context: SpriteExecutionContext) {
        this.context = context;
        context.getSystem('events').on('state:loaded', this.handleStateLoaded);
    }

    reset = () => {
        for (const anim of this.activeAnimations.values()) {
            anim.running = false;
            if (anim.frameId) cancelAnimationFrame(anim.frameId);
        }
        this.activeAnimations.clear();
        this.sprites.clear();
    };

    private async animate(command: SpriteCommand, engine: SpriteExecutionContext) {
        const spritesheets = engine.getSystem('spritesheets');
        const state = engine.getSystem('state');
        if (!command.animation) {
            engine.logger.warn(`Sprite 'animate' requires an animation name (id: '${command.id}')`);
            return;
        }

        const sprite = this.sprites.get(command.id);
        if (!sprite) {
            engine.logger.warn(`Sprite '${command.id}' not found for 'animate'`);
            return;
        }

        const charData = this.findCharacter(command.id, engine);
        if (!charData?.animations?.[command.animation]) {
            engine.logger.warn(`Animation '${command.animation}' not found for character '${command.id}'`);
            return;
        }

        const animConfig = charData.animations[command.animation];
        const frames: string[] = animConfig.frames;
        const speed: number = animConfig.speed ?? 100;
        const loop: boolean = animConfig.loop ?? false;

        const sheetConfig = charData.spritesheet;
        if (sheetConfig?.atlasUrl && !spritesheets.has(sheetConfig.atlasUrl)) {
            await spritesheets.load(sheetConfig);
        }

        const textures: Texture[] = [];
        for (const frameName of frames) {
            const tex = sheetConfig?.atlasUrl
                ? spritesheets.getFrame(sheetConfig.atlasUrl, frameName)
                : await engine.loadAsset<Texture>(frameName);
            if (tex) {
                textures.push(tex);
            } else {
                engine.logger.warn(`Animation frame '${frameName}' not found`);
                return;
            }
        }

        if (textures.length === 0) return;

        this.stopAnimation(command.id);

        const anim: ActiveAnimation = { frameId: 0, running: true };
        this.activeAnimations.set(command.id, anim);

        if (command.wait && !loop) {
            await this.playAnimation(sprite, textures, speed, false, anim);
        } else {
            void this.playAnimation(sprite, textures, speed, loop, anim);
        }

        // Update saved state
        const sprites = state.system.sprites;
        if (sprites[command.id]) {
            sprites[command.id].animation = command.animation;
        }
    }

    /* Animation */

    private async changePose(command: SpriteCommand, engine: SpriteExecutionContext) {
        const state = engine.getSystem('state');
        this.stopAnimation(command.id);

        const texture = await this.resolveTexture(command, engine);
        if (!texture) {
            engine.logger.warn(`Sprite 'pose' could not resolve texture (id: '${command.id}')`);
            return;
        }

        const sprite = this.sprites.get(command.id);
        if (!sprite) { engine.logger.warn(`Sprite '${command.id}' not found for 'pose'`); return; }

        sprite.texture = texture;

        if (command.flip !== undefined) {
            sprite.scale.x = command.flip ? -Math.abs(sprite.scale.x) : Math.abs(sprite.scale.x);
        }

        const sprites = state.system.sprites;
        if (sprites[command.id]) {
            sprites[command.id].assetUrl = command.assetUrl;
            sprites[command.id].pose = command.pose;
            sprites[command.id].animation = undefined;
        }
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

    /* Texture Resolution */

    private findCharacter(spriteId: string, engine: SpriteExecutionContext): CharacterDefinition | undefined {
        const chars = engine.manifest?.characters;
        if (!chars) return undefined;
        return chars[spriteId] ||
            Object.entries(chars).find(([k]) => k.toLowerCase() === spriteId.toLowerCase())?.[1] ||
            undefined;
    }

    private async getSheetFrame(
        sheetConfig: { atlasUrl: string; chromaKey?: string; chromaTolerance?: number },
        frameName: string,
        engine: SpriteExecutionContext
    ): Promise<Texture | undefined> {
        const spritesheets = engine.getSystem('spritesheets');
        if (!spritesheets.has(sheetConfig.atlasUrl)) {
            await spritesheets.load(sheetConfig);
        }
        return spritesheets.getFrame(sheetConfig.atlasUrl, frameName) ?? undefined;
    }

    private readonly handleStateLoaded = (...arguments_: unknown[]) => {
        const saveData = arguments_[0] as SaveState;
        if (!this.context) return;

        for (const [id, sprite] of Object.entries(saveData.system.sprites)) {
            void this.execute({
                action: 'show',
                anchorX: sprite.anchorX,
                anchorY: sprite.anchorY,
                assetUrl: sprite.assetUrl,
                flip: sprite.flip,
                id,
                pose: sprite.pose,
                scaleX: sprite.scaleX,
                scaleY: sprite.scaleY,
                transition: 'instant',
                type: 'sprite',
                x: sprite.x,
                y: sprite.y,
            }, this.context).then(async () => {
                if (sprite.animation && this.context) {
                    await this.execute({
                        action: 'animate',
                        animation: sprite.animation,
                        id,
                        type: 'sprite',
                    }, this.context);
                }
            });
        }
    };

    /* Actions */

    private async hide(command: SpriteCommand, engine: SpriteExecutionContext) {
        const state = engine.getSystem('state');
        this.stopAnimation(command.id);

        const sprite = this.sprites.get(command.id);
        if (!sprite) return;

        if (command.transition === 'fade') await this.fadeOut(sprite, command.duration ?? 300);

        sprite.removeFromParent();
        sprite.destroy();
        this.sprites.delete(command.id);

        const sprites = state.system.sprites;
        delete sprites[command.id];
    }

    private async move(command: SpriteCommand, engine: SpriteExecutionContext) {
        const state = engine.getSystem('state');
        const sprite = this.sprites.get(command.id);
        if (!sprite) { engine.logger.warn(`Sprite '${command.id}' not found for 'move'`); return; }

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

        const sprites = state.system.sprites;
        if (sprites[command.id]) {
            sprites[command.id].x = sprite.x;
            sprites[command.id].y = sprite.y;
        }
    }

    private playAnimation(
        sprite: Sprite,
        textures: Texture[],
        speed: number,
        loop: boolean,
        anim: ActiveAnimation
    ): Promise<void> {
        return new Promise((resolve) => {
            let frameIndex = 0;
            let lastTime = performance.now();

            const tick = (time: number) => {
                if (!anim.running) {
                    resolve();
                    return;
                }

                const elapsed = time - lastTime;
                if (elapsed >= speed) {
                    frameIndex++;

                    if (frameIndex >= textures.length) {
                        if (loop) {
                            frameIndex = 0;
                        } else {
                            anim.running = false;
                            resolve();
                            return;
                        }
                    }

                    sprite.texture = textures[frameIndex];
                    lastTime = time;
                }

                anim.frameId = requestAnimationFrame(tick);
            };

            sprite.texture = textures[0];
            anim.frameId = requestAnimationFrame(tick);
        });
    }

    private async resolveTexture(
        command: SpriteCommand,
        engine: SpriteExecutionContext
    ): Promise<Texture | undefined> {
        if (command.pose) {
            const charData = this.findCharacter(command.id, engine);
            if (!charData) {
                engine.logger.warn(`No character config found for sprite id '${command.id}'`);
                return undefined;
            }
            const frameName = charData.poses?.[command.pose];
            if (!frameName) {
                engine.logger.warn(`Pose '${command.pose}' not found for character '${command.id}'`);
                return undefined;
            }
            if (charData.spritesheet?.atlasUrl) {
                return await this.getSheetFrame(charData.spritesheet, frameName, engine);
            }
            return await engine.loadAsset<Texture>(frameName);
        }

        const url = command.assetUrl;
        if (!url) return undefined;

        if (url.includes(':') && !url.startsWith('http') && !url.startsWith('/')) {
            const [atlasKey, frameName] = url.split(':');
            const frame = engine.getSystem('spritesheets').getFrame(atlasKey, frameName);
            if (frame) return frame;
            engine.logger.warn(`Frame '${frameName}' not found in atlas '${atlasKey}'`);
            return undefined;
        }

        return await engine.loadAsset<Texture>(url);
    }

    private async show(command: SpriteCommand, engine: SpriteExecutionContext) {
        const texture = await this.resolveTexture(command, engine);
        if (!texture) {
            if (command.assetUrl) {
                const fallback = await engine.loadAsset<Texture>(command.assetUrl);
                return this.showWithTexture(command, fallback, engine);
            }
            engine.logger.warn(`Sprite 'show' could not resolve texture (id: '${command.id}')`);
            return;
        }
        await this.showWithTexture(command, texture, engine);
    }

    /* Fades */

    private async showWithTexture(command: SpriteCommand, texture: Texture, engine: SpriteExecutionContext) {
        const display = engine.getSystem('display');
        const state = engine.getSystem('state');
        let sprite = this.sprites.get(command.id);
        if (sprite) {
            sprite.texture = texture;
        } else {
            sprite = new Sprite(texture);
            this.sprites.set(command.id, sprite);
            engine.getLayer('sprites').addChild(sprite);
        }

        const charData = this.findCharacter(command.id, engine);
        const defaults = charData?.displayDefaults;

        sprite.anchor.set(
            command.anchorX ?? defaults?.anchorX ?? 0.5,
            command.anchorY ?? defaults?.anchorY ?? 1
        );
        sprite.position.set(
            command.x ?? defaults?.x ?? display.width / 2,
            command.y ?? defaults?.y ?? display.height
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

        const sprites = state.system.sprites;
        sprites[command.id] = {
            anchorX: sprite.anchor.x,
            anchorY: sprite.anchor.y,
            assetUrl: command.assetUrl, 
            flip: command.flip ?? defaults?.flip ?? false,
            pose: command.pose, 
            scaleX: sprite.scale.x,
            scaleY: sprite.scale.y, 
            x: sprite.x,
            y: sprite.y,
        };
    }

    private stopAnimation(id: string) {
        const existing = this.activeAnimations.get(id);
        if (existing) {
            existing.running = false;
            if (existing.frameId) cancelAnimationFrame(existing.frameId);
            this.activeAnimations.delete(id);
        }
    }
}

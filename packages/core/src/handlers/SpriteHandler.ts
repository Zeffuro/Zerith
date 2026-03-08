import { Sprite, type Texture } from 'pixi.js';
import type { BaseCommand, CommandHandler, CharacterDefinition } from '../types';
import type { Engine } from '../Engine';

export interface SpriteCommand extends BaseCommand {
    type: 'sprite';
    id: string;
    action: 'show' | 'hide' | 'move' | 'pose' | 'animate';
    assetUrl?: string;
    pose?: string;
    animation?: string;
    wait?: boolean;
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

interface ActiveAnimation {
    frameId: number;
    running: boolean;
}

export class SpriteHandler implements CommandHandler<SpriteCommand> {
    public type: 'sprite' = 'sprite';
    public autoNext = true;
    private sprites: Map<string, Sprite> = new Map();
    private activeAnimations: Map<string, ActiveAnimation> = new Map();

    reset = () => {
        for (const anim of this.activeAnimations.values()) {
            anim.running = false;
            if (anim.frameId) cancelAnimationFrame(anim.frameId);
        }
        this.activeAnimations.clear();
        this.sprites.clear();
    };

    execute = async (command: SpriteCommand, engine: Engine) => {
        switch (command.action) {
            case 'show': await this.show(command, engine); break;
            case 'hide': await this.hide(command, engine); break;
            case 'move': await this.move(command, engine); break;
            case 'pose': await this.changePose(command, engine); break;
            case 'animate': await this.animate(command, engine); break;
        }
    };

    /* Animation */

    private async animate(command: SpriteCommand, engine: Engine) {
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
        if (sheetConfig?.atlasUrl && !engine.spritesheets.has(sheetConfig.atlasUrl)) {
            await engine.spritesheets.load(sheetConfig);
        }

        const textures: Texture[] = [];
        for (const frameName of frames) {
            const tex = sheetConfig?.atlasUrl
                ? engine.spritesheets.getFrame(sheetConfig.atlasUrl, frameName)
                : await engine.loadAsset(frameName);
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
            this.playAnimation(sprite, textures, speed, loop, anim);
        }

        // Update saved state
        const sprites = engine.getState('__sys_sprites') ?? {};
        if (sprites[command.id]) {
            sprites[command.id].animation = command.animation;
            engine.setState('__sys_sprites', sprites);
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

    private stopAnimation(id: string) {
        const existing = this.activeAnimations.get(id);
        if (existing) {
            existing.running = false;
            if (existing.frameId) cancelAnimationFrame(existing.frameId);
            this.activeAnimations.delete(id);
        }
    }

    /* Texture Resolution */

    private async resolveTexture(
        command: SpriteCommand,
        engine: Engine
    ): Promise<Texture | null> {
        if (command.pose) {
            const charData = this.findCharacter(command.id, engine);
            if (!charData) {
                engine.logger.warn(`No character config found for sprite id '${command.id}'`);
                return null;
            }
            const frameName = charData.poses?.[command.pose];
            if (!frameName) {
                engine.logger.warn(`Pose '${command.pose}' not found for character '${command.id}'`);
                return null;
            }
            if (charData.spritesheet?.atlasUrl) {
                return await this.getSheetFrame(charData.spritesheet, frameName, engine);
            }
            return await engine.loadAsset(frameName);
        }

        const url = command.assetUrl;
        if (!url) return null;

        if (url.includes(':') && !url.startsWith('http') && !url.startsWith('/')) {
            const [atlasKey, frameName] = url.split(':');
            const frame = engine.spritesheets.getFrame(atlasKey, frameName);
            if (frame) return frame;
            engine.logger.warn(`Frame '${frameName}' not found in atlas '${atlasKey}'`);
            return null;
        }

        return await engine.loadAsset(url);
    }

    private async getSheetFrame(
        sheetConfig: { atlasUrl: string; chromaKey?: string; chromaTolerance?: number },
        frameName: string,
        engine: Engine
    ): Promise<Texture | null> {
        if (!engine.spritesheets.has(sheetConfig.atlasUrl)) {
            await engine.spritesheets.load(sheetConfig);
        }
        return engine.spritesheets.getFrame(sheetConfig.atlasUrl, frameName) ?? null;
    }

    private findCharacter(spriteId: string, engine: Engine): CharacterDefinition | null {
        const chars = engine.manifest?.characters;
        if (!chars) return null;
        return chars[spriteId] ||
            Object.entries(chars).find(([k]) => k.toLowerCase() === spriteId.toLowerCase())?.[1] ||
            null;
    }

    /* Actions */

    private async show(command: SpriteCommand, engine: Engine) {
        const texture = await this.resolveTexture(command, engine);
        if (!texture) {
            if (command.assetUrl) {
                const fallback = await engine.loadAsset(command.assetUrl);
                return this.showWithTexture(command, fallback, engine);
            }
            engine.logger.warn(`Sprite 'show' could not resolve texture (id: '${command.id}')`);
            return;
        }
        await this.showWithTexture(command, texture, engine);
    }

    private async showWithTexture(command: SpriteCommand, texture: Texture, engine: Engine) {
        let sprite = this.sprites.get(command.id);
        if (!sprite) {
            sprite = new Sprite(texture);
            this.sprites.set(command.id, sprite);
            engine.layers.sprites.addChild(sprite);
        } else {
            sprite.texture = texture;
        }

        const charData = this.findCharacter(command.id, engine);
        const defaults = charData?.displayDefaults;

        sprite.anchor.set(
            command.anchorX ?? defaults?.anchorX ?? 0.5,
            command.anchorY ?? defaults?.anchorY ?? 1
        );
        sprite.position.set(
            command.x ?? defaults?.x ?? engine.display.width / 2,
            command.y ?? defaults?.y ?? engine.display.height
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

        const sprites = engine.getState('__sys_sprites') ?? {};
        sprites[command.id] = {
            assetUrl: command.assetUrl,
            pose: command.pose,
            x: sprite.x, y: sprite.y,
            anchorX: sprite.anchor.x, anchorY: sprite.anchor.y,
            scaleX: sprite.scale.x, scaleY: sprite.scale.y,
            flip: command.flip ?? defaults?.flip ?? false,
        };
        engine.setState('__sys_sprites', sprites);
    }

    private async hide(command: SpriteCommand, engine: Engine) {
        this.stopAnimation(command.id);

        const sprite = this.sprites.get(command.id);
        if (!sprite) return;

        if (command.transition === 'fade') await this.fadeOut(sprite, command.duration ?? 300);

        engine.layers.sprites.removeChild(sprite);
        sprite.destroy();
        this.sprites.delete(command.id);

        const sprites = engine.getState('__sys_sprites') ?? {};
        delete sprites[command.id];
        engine.setState('__sys_sprites', sprites);
    }

    private async move(command: SpriteCommand, engine: Engine) {
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
                sprite!.position.set(
                    startX + (targetX - startX) * progress,
                    startY + (targetY - startY) * progress
                );
                if (progress < 1) { requestAnimationFrame(tick); }
                else {
                    if (command.flip !== undefined) {
                        sprite!.scale.x = command.flip ? -Math.abs(sprite!.scale.x) : Math.abs(sprite!.scale.x);
                    }
                    resolve();
                }
            };
            requestAnimationFrame(tick);
        });

        const sprites = engine.getState('__sys_sprites') ?? {};
        if (sprites[command.id]) {
            sprites[command.id].x = sprite.x;
            sprites[command.id].y = sprite.y;
            engine.setState('__sys_sprites', sprites);
        }
    }

    private async changePose(command: SpriteCommand, engine: Engine) {
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

        const sprites = engine.getState('__sys_sprites') ?? {};
        if (sprites[command.id]) {
            sprites[command.id].assetUrl = command.assetUrl;
            sprites[command.id].pose = command.pose;
            sprites[command.id].animation = undefined;
            engine.setState('__sys_sprites', sprites);
        }
    }

    /* Fades */

    private fadeIn(sprite: Sprite, duration: number): Promise<void> {
        sprite.alpha = 0;
        const startTime = performance.now();
        return new Promise((resolve) => {
            const tick = (time: number) => {
                const p = Math.min((time - startTime) / duration, 1);
                sprite.alpha = p;
                p < 1 ? requestAnimationFrame(tick) : resolve();
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
                p < 1 ? requestAnimationFrame(tick) : resolve();
            };
            requestAnimationFrame(tick);
        });
    }
}
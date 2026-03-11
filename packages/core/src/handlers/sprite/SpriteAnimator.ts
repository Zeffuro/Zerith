import type { Sprite, Texture } from 'pixi.js';

interface ActiveAnimation {
    frameId: number;
    running: boolean;
}

interface RunAnimationOptions {
    id: string;
    loop: boolean;
    speed: number;
    sprite: Sprite;
    textures: Texture[];
    wait: boolean;
}

export class SpriteAnimator {
    private readonly activeAnimations = new Map<string, ActiveAnimation>();

    public async runAnimation(options: RunAnimationOptions): Promise<void> {
        const { id, loop, speed, sprite, textures, wait } = options;
        if (textures.length === 0) return;

        this.stopAnimation(id);

        const animation: ActiveAnimation = { frameId: 0, running: true };
        this.activeAnimations.set(id, animation);

        if (wait) {
            await this.playAnimation(sprite, textures, speed, false, animation);
            return;
        }

        void this.playAnimation(sprite, textures, speed, loop, animation);
    }

    public stopAllAnimations(): void {
        for (const animation of this.activeAnimations.values()) {
            animation.running = false;
            if (animation.frameId) {
                cancelAnimationFrame(animation.frameId);
            }
        }

        this.activeAnimations.clear();
    }

    public stopAnimation(id: string): void {
        const existing = this.activeAnimations.get(id);
        if (!existing) {
            return;
        }

        existing.running = false;
        if (existing.frameId) {
            cancelAnimationFrame(existing.frameId);
        }
        this.activeAnimations.delete(id);
    }

    private playAnimation(
        sprite: Sprite,
        textures: Texture[],
        speed: number,
        loop: boolean,
        animation: ActiveAnimation,
    ): Promise<void> {
        return new Promise((resolve) => {
            let frameIndex = 0;
            let lastTime = performance.now();

            const tick = (time: number) => {
                if (!animation.running) {
                    resolve();
                    return;
                }

                const elapsed = time - lastTime;
                if (elapsed >= speed) {
                    frameIndex++;
                    if (frameIndex >= textures.length) {
                        if (!loop) {
                            animation.running = false;
                            resolve();
                            return;
                        }
                        frameIndex = 0;
                    }

                    sprite.texture = textures[frameIndex];
                    lastTime = time;
                }

                animation.frameId = requestAnimationFrame(tick);
            };

            sprite.texture = textures[0];
            animation.frameId = requestAnimationFrame(tick);
        });
    }
}


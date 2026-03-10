import gsap from 'gsap';

import type { IAnimationManager } from '../interfaces/managers';

type GsapTimeline = gsap.core.Timeline;
type GsapTween = gsap.core.Tween;

export class AnimationManager implements IAnimationManager {
    private readonly timelines: Set<GsapTimeline> = new Set();
    private readonly tweens: Set<GsapTween> = new Set();

    public destroy() {
        for (const timeline of this.timelines) {
            timeline.kill();
        }
        this.timelines.clear();

        for (const tween of this.tweens) {
            tween.kill();
        }
        this.tweens.clear();
    }

    public killTweensOf(target: unknown): void {
        gsap.killTweensOf(target as gsap.TweenTarget);
    }

    public set(target: unknown, vars: unknown): void {
        gsap.set(target as gsap.TweenTarget, vars as gsap.TweenVars);
    }

    public timeline(): GsapTimeline {
        const timeline = gsap.timeline();
        this.timelines.add(timeline);

        timeline.eventCallback('onComplete', () => {
            this.timelines.delete(timeline);
        });

        return timeline;
    }

    public to(target: unknown, vars: unknown): Promise<void> {
        return new Promise((resolve) => {
            const inputVars = typeof vars === 'object' && vars !== null
                ? vars as Record<string, unknown>
                : {};

            const originalComplete = inputVars.onComplete as (() => void) | undefined;
            const originalInterrupt = inputVars.onInterrupt as (() => void) | undefined;

            let tween!: GsapTween;
            let settled = false;
            const settle = () => {
                if (settled) return;
                settled = true;
                this.tweens.delete(tween);
                resolve();
            };

            tween = gsap.to(target as gsap.TweenTarget, {
                ...inputVars,
                onComplete: () => {
                    originalComplete?.();
                    settle();
                },
                onInterrupt: () => {
                    originalInterrupt?.();
                    settle();
                },
            });

            this.tweens.add(tween);
        });
    }
}


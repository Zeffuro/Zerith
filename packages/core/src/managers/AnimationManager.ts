import gsap from 'gsap';

import type { IAnimationManager } from '../interfaces/managers';

type GsapTimeline = gsap.core.Timeline;
type GsapTween = gsap.core.Tween;

export class AnimationManager implements IAnimationManager {
    private readonly timelines: Set<GsapTimeline> = new Set();
    private readonly tweens: Set<GsapTween> = new Set();

    public clear(): void {
        for (const timeline of this.timelines) {
            timeline.kill();
        }
        this.timelines.clear();

        for (const tween of this.tweens) {
            tween.kill();
        }
        this.tweens.clear();
    }

    public destroy() {
        this.clear();
    }

    public killTweensOf(target: unknown): void {
        gsap.killTweensOf(target as gsap.TweenTarget);
    }

    public set(target: unknown, variables: unknown): void {
        gsap.set(target as gsap.TweenTarget, variables as gsap.TweenVars);
    }

    public timeline(): GsapTimeline {
        const timeline = gsap.timeline();
        this.timelines.add(timeline);

        timeline.eventCallback('onComplete', () => {
            this.timelines.delete(timeline);
        });

        return timeline;
    }

    public to(target: unknown, variables: unknown): Promise<void> {
        return new Promise((resolve) => {
            const inputVariables = typeof variables === 'object' && variables !== null
                ? variables as Record<string, unknown>
                : {};

            const originalComplete = inputVariables.onComplete as (() => void) | undefined;
            const originalInterrupt = inputVariables.onInterrupt as (() => void) | undefined;

            let settled = false;
            const tween = gsap.to(target as gsap.TweenTarget, {
                ...inputVariables,
                onComplete: () => {
                    originalComplete?.();
                    settle();
                },
                onInterrupt: () => {
                    originalInterrupt?.();
                    settle();
                },
            });

            const settle = () => {
                if (settled) return;
                settled = true;
                this.tweens.delete(tween);
                resolve();
            };

            this.tweens.add(tween);
        });
    }
}


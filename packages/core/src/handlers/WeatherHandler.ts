import { Container, Graphics } from 'pixi.js';

import type { BuiltInDisplayLayerName, IDisplayManager, IEventBus, IStateManager } from '../interfaces/managers';
import type { SaveState } from '../managers/SaveManager';
import type { BaseCommand, CommandHandler } from '../types';

export interface WeatherCommand extends BaseCommand {
    action?: 'clear' | 'start' | 'stop';
    alpha?: number;
    angle?: number;
    color?: number;
    density?: number;
    fadeIn?: number;
    fadeOut?: number;
    id?: string;
    layer?: WeatherEffectLayer;
    preset?: WeatherPreset;
    size?: number;
    speed?: number;
    type: 'weather';
    wind?: number;
}
export type WeatherEffectLayer = ({} & string) | Exclude<BuiltInDisplayLayerName, 'ui'>;

export interface WeatherEffectState {
    alpha?: number;
    angle?: number;
    color?: number;
    density?: number;
    id: string;
    layer?: WeatherEffectLayer;
    preset: WeatherPreset;
    size?: number;
    speed?: number;
    wind?: number;
}

export type WeatherParticleKind = 'ash' | 'embers' | 'rain' | 'snow';

export type WeatherPreset =
    | 'ash'
    | 'ashfall'
    | 'blizzard'
    | 'drizzle'
    | 'embers'
    | 'heavy_rain'
    | 'rain'
    | 'snow'
    | 'snowfall'
    | 'storm';

export interface WeatherPresetConfig {
    alpha: number;
    angle: number;
    color: number;
    defaultId: string;
    density: number;
    label: string;
    layer: WeatherEffectLayer;
    particle: WeatherParticleKind;
    size: number;
    speed: number;
    wind: number;
}

interface ActiveWeatherEffect {
    config: ResolvedWeatherConfig;
    container: Container;
    fade?: {
        duration: number;
        elapsed: number;
        from: number;
        removeOnComplete: boolean;
        to: number;
    };
    frameRequest?: unknown;
    lastTime: number | undefined;
    particles: Particle[];
}

interface Particle {
    driftPhase: number;
    graphic: Graphics;
    speedMultiplier: number;
    x: number;
    y: number;
}

interface ResolvedWeatherConfig extends WeatherEffectState {
    alpha: number;
    angle: number;
    color: number;
    density: number;
    layer: WeatherEffectLayer;
    particle: WeatherParticleKind;
    size: number;
    speed: number;
    wind: number;
}

export const WEATHER_PRESET_DEFAULTS: Record<WeatherPreset, WeatherPresetConfig> = {
    ash: {
        alpha: 0.65,
        angle: -8,
        color: 0x9C_A3_AF,
        defaultId: 'ash',
        density: 100,
        label: 'Ashfall',
        layer: 'foregroundEffects',
        particle: 'ash',
        size: 2.4,
        speed: 50,
        wind: 18,
    },
    ashfall: {
        alpha: 0.65,
        angle: -8,
        color: 0x9C_A3_AF,
        defaultId: 'ash',
        density: 100,
        label: 'Ashfall',
        layer: 'foregroundEffects',
        particle: 'ash',
        size: 2.4,
        speed: 50,
        wind: 18,
    },
    blizzard: {
        alpha: 0.95,
        angle: -12,
        color: 0xFF_FF_FF,
        defaultId: 'snow',
        density: 260,
        label: 'Blizzard',
        layer: 'foregroundEffects',
        particle: 'snow',
        size: 2.5,
        speed: 220,
        wind: 160,
    },
    drizzle: {
        alpha: 0.3,
        angle: 6,
        color: 0xC8_DD_FF,
        defaultId: 'rain',
        density: 70,
        label: 'Drizzle',
        layer: 'foregroundEffects',
        particle: 'rain',
        size: 0.8,
        speed: 550,
        wind: 0,
    },
    embers: {
        alpha: 0.9,
        angle: 0,
        color: 0xFF_B0_20,
        defaultId: 'embers',
        density: 65,
        label: 'Embers',
        layer: 'foregroundEffects',
        particle: 'embers',
        size: 2.6,
        speed: 70,
        wind: 10,
    },
    heavy_rain: {
        alpha: 0.55,
        angle: 12,
        color: 0xBF_D8_FF,
        defaultId: 'rain',
        density: 260,
        label: 'Heavy Rain',
        layer: 'foregroundEffects',
        particle: 'rain',
        size: 1.1,
        speed: 1000,
        wind: 45,
    },
    rain: {
        alpha: 0.45,
        angle: 10,
        color: 0xBF_D8_FF,
        defaultId: 'rain',
        density: 140,
        label: 'Rain',
        layer: 'foregroundEffects',
        particle: 'rain',
        size: 1,
        speed: 850,
        wind: 0,
    },
    snow: {
        alpha: 0.95,
        angle: 0,
        color: 0xFF_FF_FF,
        defaultId: 'snow',
        density: 120,
        label: 'Snowfall',
        layer: 'foregroundEffects',
        particle: 'snow',
        size: 3,
        speed: 95,
        wind: 25,
    },
    snowfall: {
        alpha: 0.95,
        angle: 0,
        color: 0xFF_FF_FF,
        defaultId: 'snow',
        density: 120,
        label: 'Snowfall',
        layer: 'foregroundEffects',
        particle: 'snow',
        size: 3,
        speed: 95,
        wind: 25,
    },
    storm: {
        alpha: 0.65,
        angle: 15,
        color: 0xA8_C7_FF,
        defaultId: 'rain',
        density: 340,
        label: 'Storm',
        layer: 'foregroundEffects',
        particle: 'rain',
        size: 1.3,
        speed: 1200,
        wind: 120,
    },
};

const MAX_PARTICLES = 600;

export class WeatherHandler implements CommandHandler<WeatherCommand> {
    public autoNext = true;
    public type = 'weather' as const;
    private readonly display: IDisplayManager;
    private readonly effects = new Map<string, ActiveWeatherEffect>();
    private readonly events: IEventBus;
    private readonly state: IStateManager;

    constructor(display: IDisplayManager, state: IStateManager, events: IEventBus) {
        this.display = display;
        this.state = state;
        this.events = events;
        this.events.on('state:loaded', this.handleStateLoaded);
    }

    public destroy(): void {
        this.events.off('state:loaded', this.handleStateLoaded);
        this.reset();
    }

    execute = (command: WeatherCommand) => {
        switch (command.action ?? 'start') {
            case 'clear': {
                this.clear(command.fadeOut);
                break;
            }

            case 'start': {
                this.start(command);
                break;
            }

            case 'stop': {
                this.stop(command);
                break;
            }
        }
    };

    public reset(): void {
        for (const id of this.effects.keys()) {
            this.destroyEffect(id);
        }
    }

    private clear(fadeOut?: number): void {
        for (const id of this.effects.keys()) {
            this.stopEffect(id, fadeOut, false);
        }
        this.state.system.weather = {};
    }

    private createParticle(config: ResolvedWeatherConfig): Particle {
        const graphic = new Graphics();
        const size = config.size * randomBetween(0.75, 1.35);

        switch (config.particle) {
            case 'ash': {
                graphic
                    .rect(-size / 2, -size / 2, size, size)
                    .fill({
                        alpha: config.alpha,
                        color: config.color,
                    });
                graphic.rotation = randomBetween(0, Math.PI);
                break;
            }

            case 'embers': {
                graphic
                    .circle(0, 0, Math.max(2, size * 2.2))
                    .fill({
                        alpha: config.alpha * 0.25,
                        color: config.color,
                    })
                    .circle(0, 0, Math.max(1, size))
                    .fill({
                        alpha: config.alpha,
                        color: config.color,
                    });
                break;
            }

            case 'rain': {
                const length = Math.max(8, size * 16);
                const angle = toRadians(config.angle);
                graphic
                    .moveTo(0, 0)
                    .lineTo(Math.sin(angle) * length, Math.cos(angle) * length)
                    .stroke({
                        alpha: config.alpha,
                        color: config.color,
                        width: Math.max(1, size),
                    });
                break;
            }

            case 'snow': {
                graphic
                    .circle(0, 0, Math.max(1.5, size))
                    .fill({
                        alpha: config.alpha,
                        color: config.color,
                    });
                break;
            }
        }

        return {
            driftPhase: randomBetween(0, Math.PI * 2),
            graphic,
            speedMultiplier: randomBetween(0.7, 1.3),
            x: randomBetween(-this.display.width * 0.1, this.display.width * 1.1),
            y: randomBetween(-this.display.height * 0.1, this.display.height * 1.1),
        };
    }

    private destroyEffect(id: string): void {
        const effect = this.effects.get(id);
        if (!effect) return;

        if (effect.frameRequest !== undefined) {
            cancelFrame(effect.frameRequest);
        }

        effect.container.removeFromParent();
        effect.container.destroy({ children: true });
        this.effects.delete(id);
    }

    private readonly handleStateLoaded = (saveData: SaveState): void => {
        this.reset();

        for (const effect of Object.values(saveData.system.weather)) {
            this.start({
                ...effect,
                action: 'start',
                fadeIn: 0,
                type: 'weather',
            });
        }
    };

    private redrawEffect(config: ResolvedWeatherConfig): ActiveWeatherEffect {
        const particleCount = clamp(Math.round(config.density), 0, MAX_PARTICLES);
        const container = new Container();
        const particles = Array.from({ length: particleCount }, () => this.createParticle(config));

        for (const particle of particles) {
            particle.graphic.position.set(particle.x, particle.y);
            container.addChild(particle.graphic);
        }

        this.display.getLayer(config.layer).addChild(container);

        return {
            config,
            container,
            lastTime: undefined,
            particles,
        };
    }

    private resetParticleAtBottom(particle: Particle, margin: number): void {
        particle.x = randomBetween(-margin, this.display.width + margin);
        particle.y = randomBetween(this.display.height, this.display.height + margin);
    }

    private resetParticleAtTop(particle: Particle, margin: number): void {
        particle.x = randomBetween(-margin, this.display.width + margin);
        particle.y = randomBetween(-margin, 0);
    }

    private resolveConfig(command: WeatherCommand): ResolvedWeatherConfig {
        const preset = command.preset ?? 'rain';
        const defaults = WEATHER_PRESET_DEFAULTS[preset];
        const id = command.id?.trim() || defaults.defaultId;

        return {
            alpha: sanitizeNumber(command.alpha, defaults.alpha, 0, 1),
            angle: sanitizeNumber(command.angle, defaults.angle, -89, 89),
            color: sanitizeInteger(command.color, defaults.color, 0),
            density: sanitizeNumber(command.density, defaults.density, 0, MAX_PARTICLES),
            id,
            layer: resolveWeatherLayer(command.layer, defaults.layer),
            particle: defaults.particle,
            preset,
            size: sanitizeNumber(command.size, defaults.size, 0.1, 24),
            speed: sanitizeNumber(command.speed, defaults.speed, 0, 4000),
            wind: sanitizeNumber(command.wind, defaults.wind, -2000, 2000),
        };
    }

    private scheduleNextFrame(id: string): void {
        const effect = this.effects.get(id);
        if (!effect) return;

        effect.frameRequest = scheduleFrame((time) => {
            this.tickEffect(id, time);
        });
    }

    private serializeConfig(config: ResolvedWeatherConfig): WeatherEffectState {
        return {
            alpha: config.alpha,
            angle: config.angle,
            color: config.color,
            density: config.density,
            id: config.id,
            layer: config.layer,
            preset: config.preset,
            size: config.size,
            speed: config.speed,
            wind: config.wind,
        };
    }

    private start(command: WeatherCommand): void {
        const config = this.resolveConfig(command);
        this.destroyEffect(config.id);

        const effect = this.redrawEffect(config);
        const fadeIn = sanitizeNumber(command.fadeIn, 0, 0, 60_000);

        if (fadeIn > 0) {
            effect.container.alpha = 0;
            effect.fade = {
                duration: fadeIn,
                elapsed: 0,
                from: 0,
                removeOnComplete: false,
                to: 1,
            };
        }

        this.effects.set(config.id, effect);
        this.state.system.weather[config.id] = this.serializeConfig(config);
        this.scheduleNextFrame(config.id);
    }

    private stop(command: WeatherCommand): void {
        const preset = command.preset ?? 'rain';
        const id = command.id?.trim() || WEATHER_PRESET_DEFAULTS[preset].defaultId;
        this.stopEffect(id, command.fadeOut, true);
    }

    private stopEffect(id: string, fadeOut?: number, persist = true): void {
        const effect = this.effects.get(id);
        if (persist) {
            delete this.state.system.weather[id];
        }

        if (!effect) return;

        const duration = sanitizeNumber(fadeOut, 0, 0, 60_000);
        if (duration <= 0) {
            this.destroyEffect(id);
            return;
        }

        effect.fade = {
            duration,
            elapsed: 0,
            from: effect.container.alpha,
            removeOnComplete: true,
            to: 0,
        };
    }

    private tickEffect(id: string, time: number): void {
        const effect = this.effects.get(id);
        if (!effect) return;

        const deltaMs = effect.lastTime === undefined
            ? 16
            : Math.min(time - effect.lastTime, 100);
        effect.lastTime = time;

        const deltaSeconds = deltaMs / 1000;

        this.updateFade(id, effect, deltaMs);
        if (!this.effects.has(id)) return;

        this.updateParticles(effect, deltaSeconds);
        this.scheduleNextFrame(id);
    }

    private updateFade(id: string, effect: ActiveWeatherEffect, deltaMs: number): void {
        if (!effect.fade) return;

        effect.fade.elapsed += deltaMs;
        const progress = clamp(effect.fade.elapsed / effect.fade.duration, 0, 1);
        effect.container.alpha = effect.fade.from + (effect.fade.to - effect.fade.from) * progress;

        if (progress < 1) return;

        const removeOnComplete = effect.fade.removeOnComplete;
        effect.fade = undefined;
        if (removeOnComplete) {
            this.destroyEffect(id);
        }
    }

    private updateParticles(effect: ActiveWeatherEffect, deltaSeconds: number): void {
        const config = effect.config;
        const angle = toRadians(config.angle);
        const baseVelocityX = Math.sin(angle) * config.speed + config.wind;
        const directionY = config.particle === 'embers' ? -1 : 1;
        const baseVelocityY = Math.cos(angle) * config.speed * directionY;
        const margin = 40 + config.size * 20;

        for (const particle of effect.particles) {
            particle.driftPhase += deltaSeconds;

            const drift = config.particle === 'snow' || config.particle === 'ash'
                ? Math.sin(particle.driftPhase * 2) * config.size * 10
                : 0;

            particle.x += (baseVelocityX * particle.speedMultiplier + drift) * deltaSeconds;
            particle.y += baseVelocityY * particle.speedMultiplier * deltaSeconds;

            if (directionY > 0 && particle.y > this.display.height + margin) {
                this.resetParticleAtTop(particle, margin);
            } else if (directionY < 0 && particle.y < -margin) {
                this.resetParticleAtBottom(particle, margin);
            }

            if (particle.x < -margin || particle.x > this.display.width + margin) {
                particle.x = baseVelocityX >= 0
                    ? randomBetween(-margin, 0)
                    : randomBetween(this.display.width, this.display.width + margin);
                particle.y = randomBetween(-margin, this.display.height + margin);
            }

            particle.graphic.position.set(particle.x, particle.y);
        }
    }
}

function cancelFrame(id: unknown): void {
    if (typeof id === 'number' && typeof globalThis.cancelAnimationFrame === 'function') {
        globalThis.cancelAnimationFrame(id);
        return;
    }

    clearTimeout(id as ReturnType<typeof setTimeout>);
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function randomBetween(min: number, max: number): number {
    return min + Math.random() * (max - min);
}

function resolveWeatherLayer(value: string | undefined, fallback: WeatherEffectLayer): WeatherEffectLayer {
    const layer = value?.trim();
    return layer && layer !== 'ui'
        ? layer
        : fallback;
}

function sanitizeInteger(value: number | undefined, fallback: number, min: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
    return Math.max(min, Math.trunc(value));
}

function sanitizeNumber(value: number | undefined, fallback: number, min: number, max: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
    return clamp(value, min, max);
}

function scheduleFrame(callback: FrameRequestCallback): unknown {
    if (typeof globalThis.requestAnimationFrame === 'function') {
        return globalThis.requestAnimationFrame(callback);
    }

    return setTimeout(() => callback(performance.now()), 16);
}

function toRadians(degrees: number): number {
    return degrees * Math.PI / 180;
}

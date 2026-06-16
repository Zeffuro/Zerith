import type { SpriteState } from '../handlers/SpriteHandler';
import type { WeatherEffectState } from '../handlers/WeatherHandler';

export interface DialogueState {
    portraitSide?: 'left' | 'right';
    portraitUrl?: string;
    speaker: string;
    text: string;
}

export interface SystemState {
    background?: string;
    bgm?: string;
    dialogue?: DialogueState;
    items: string[];
    sprites: Record<string, SpriteState>;
    weather: Record<string, WeatherEffectState>;
}

export function createDefaultSystemState(): SystemState {
    return {
        items: [],
        sprites: {},
        weather: {},
    };
}


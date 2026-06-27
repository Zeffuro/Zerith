import type { SpriteState } from '../handlers/SpriteHandler';
import type { WeatherEffectState } from '../handlers/WeatherHandler';
import type { HistoryEntry } from '../managers/HistoryManager';

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
    history?: HistoryEntry[];
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


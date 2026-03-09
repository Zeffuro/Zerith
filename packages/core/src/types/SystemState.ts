import type { SpriteState } from '../handlers/SpriteHandler';

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
}

export function createDefaultSystemState(): SystemState {
    return {
        items: [],
        sprites: {},
    };
}


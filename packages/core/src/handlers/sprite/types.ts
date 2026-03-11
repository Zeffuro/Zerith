import type { BaseCommand } from '../../types';

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


import type { BaseCommand, SpriteFitMode } from '../../types';

export interface SpriteCommand extends BaseCommand {
    action: 'animate' | 'hide' | 'move' | 'pose' | 'show';
    anchorX?: number;
    anchorY?: number;
    animation?: string;
    assetUrl?: string;
    duration?: number;
    fit?: SpriteFitMode;
    flip?: boolean;
    heightRatio?: number;
    id: string;
    pose?: string;
    scaleX?: number;
    scaleY?: number;
    transition?: 'fade' | 'instant';
    type: 'sprite';
    wait?: boolean;
    widthRatio?: number;
    x?: number;
    xRatio?: number;
    y?: number;
    yRatio?: number;
}

export interface SpriteState {
    alpha?: number;
    anchorX?: number;
    anchorY?: number;
    animation?: string;
    assetUrl?: string;
    fit?: SpriteFitMode;
    flip?: boolean;
    heightRatio?: number;
    pose?: string;
    scaleX?: number;
    scaleY?: number;
    widthRatio?: number;
    x?: number;
    xRatio?: number;
    y?: number;
    yRatio?: number;
}


export interface SheetDescriptorBase {
    meta?: Record<string, unknown>;
    source: string;
}

export interface SpriteFrame {
    anchorX?: number;
    anchorY?: number;
    h: number;
    name: string;
    w: number;
    x: number;
    y: number;
}

export interface SpritesheetDescriptor extends SheetDescriptorBase {
    animations?: Record<string, string[]>;
    atlasJsonPath?: string;
    chromaKey?: string;
    chromaTolerance?: number;
    format: SpritesheetFormat;
    frameHeight?: number;
    frames?: Record<string, SpriteFrame>;
    frameWidth?: number;
    margin?: number;
    spacing?: number;
}

export type SpritesheetFormat = 'atlas' | 'grid';


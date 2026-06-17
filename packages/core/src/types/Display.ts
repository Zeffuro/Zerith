export interface DisplayDefaults {
    anchorX?: number;
    anchorY?: number;
    fit?: SpriteFitMode;
    flip?: boolean;
    heightRatio?: number;
    scaleX?: number;
    scaleY?: number;
    widthRatio?: number;
    x?: number;
    xRatio?: number;
    y?: number;
    yRatio?: number;
}

export type SpriteFitMode = 'contain' | 'cover' | 'stretch';

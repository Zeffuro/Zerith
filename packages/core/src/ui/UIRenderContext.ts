import type { Container } from 'pixi.js';

import type { OverlayConfig } from '../managers/OverlayManager';
import type { Theme } from '../utils/Theme';
import type { PanelFocusManager } from './PanelFocusManager';

export interface UIVisualContext {
    canvasElement: HTMLCanvasElement;
    canvasHeight: number;
    canvasWidth: number;
    createPanelBase: () => Container;
    focus: PanelFocusManager;
    overlayConfig: Required<OverlayConfig>;
    theme: Theme;
}


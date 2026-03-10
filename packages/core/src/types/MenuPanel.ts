import type { Container } from 'pixi.js';

import type { IDisplayManager } from '../interfaces/managers';
import type { OverlayConfig } from '../managers/OverlayManager';
import type { PanelFocusManager } from '../ui/PanelFocusManager';
import type { Theme } from '../utils/Theme';

/**
 * A pluggable panel shown from the overlay menu.
 * Each panel owns its own rendering and cleanup.
 */
export interface MenuPanel {
    build(
        display: Pick<IDisplayManager, 'height' | 'width'> & { canvasElement: HTMLCanvasElement; },
        theme: Theme,
        overlayConfig: Required<OverlayConfig>,
        focus: PanelFocusManager,
        onClose: () => void,
    ): {
        cleanup?: () => void;
        container: Container;
    };
    id: string;
    label: string;
}
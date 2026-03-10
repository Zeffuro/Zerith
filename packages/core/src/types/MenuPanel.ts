import type { Container } from 'pixi.js';

import type { IDisplayManager } from '../interfaces/managers';
import type { OverlayConfig } from '../managers/OverlayManager';
import type { PanelFocusManager } from '../ui/PanelFocusManager';
import type { Theme } from '../utils/Theme';

/**
 * A pluggable panel shown from the overlay menu.
 * Each panel owns its own rendering.
 */
export interface MenuPanel {
    build(deps: PanelBuildDeps): {
        container: Container;
    };
    id: string;
    label: string;
}

export interface PanelBuildDeps {
    display: Pick<IDisplayManager, 'height' | 'width'>;
    focus: PanelFocusManager;
    onClose: () => void;
    overlayConfig: Required<OverlayConfig>;
    theme: Theme;
}

import type { Container } from 'pixi.js';

import type { UIVisualContext } from '../ui/UIRenderContext';

/**
 * A pluggable panel shown from the overlay menu.
 * Each panel owns its own rendering and cleanup.
 */
export interface MenuPanel {
    build(context: UIVisualContext, onClose: () => void): {
        cleanup?: () => void;
        container: Container;
    };
    id: string;
    label: string;
}
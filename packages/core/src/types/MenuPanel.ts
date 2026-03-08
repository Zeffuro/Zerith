import type { Container } from 'pixi.js';

import type { Engine } from '../Engine';

/**
 * A pluggable panel shown from the overlay menu.
 * Each panel owns its own rendering and cleanup.
 */
export interface MenuPanel {
    build(engine: Engine, onClose: () => void): {
        cleanup?: () => void;
        container: Container;
    };
    id: string;
    label: string;
}
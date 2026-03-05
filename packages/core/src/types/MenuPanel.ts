import type { Engine } from '../Engine';
import type { Container } from 'pixi.js';

/**
 * A pluggable panel shown from the overlay menu.
 * Each panel owns its own rendering and cleanup.
 */
export interface MenuPanel {
    label: string;
    id: string;
    build(engine: Engine, onClose: () => void): {
        container: Container;
        cleanup?: () => void;
    };
}
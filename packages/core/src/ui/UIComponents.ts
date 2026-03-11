import { Text } from 'pixi.js';

import type { OverlayConfig } from '../managers/OverlayManager';

export * from './components';

/* Panel Title */

export function createPanelTitle(
    overlayConfig: Required<OverlayConfig>,
    canvasWidth: number,
    text: string,
): Text {
    const cfg = overlayConfig;
    const title = new Text({
        style: {
            fill: cfg.textColor,
            fontFamily: cfg.fontFamily,
            fontSize: cfg.fontSize + 6,
            fontWeight: 'bold'
        },
        text
    });
    title.anchor.set(0.5, 0);
    title.position.set(canvasWidth / 2, 20);
    return title;
}



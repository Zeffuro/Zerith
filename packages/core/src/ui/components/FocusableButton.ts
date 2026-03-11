import { Container, Graphics } from 'pixi.js';

import type { OverlayConfig } from '../../managers/OverlayManager';
import type { Theme } from '../../utils/Theme';
import type { PanelFocusManager } from '../PanelFocusManager';

export function registerFocusableButton(
    theme: Theme,
    overlayConfig: Required<OverlayConfig>,
    focus: PanelFocusManager,
    button: Container,
    action: () => void,
    options?: { height?: number; width?: number; }
) {
    const cfg = overlayConfig;
    const background = button.children[0] as Graphics;
    const width = options?.width ?? cfg.buttonWidth;
    const height = options?.height ?? cfg.buttonHeight;

    focus.register({
        activate: action,
        blur: () => {
            background.clear();
            background.roundRect(0, 0, width, height, 8);
            background.fill({ alpha: cfg.buttonAlpha, color: cfg.buttonColor });
            background.stroke({ color: theme.borderColor, width: 2 });
        },
        focus: () => {
            background.clear();
            background.roundRect(0, 0, width, height, 8);
            background.fill({ alpha: 1, color: cfg.buttonHoverColor });
            background.stroke({ color: theme.accentColor, width: 2 });
        },
    });
}


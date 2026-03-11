import { Container, type FederatedPointerEvent, Graphics, Text } from 'pixi.js';

import type { OverlayConfig } from '../../managers/OverlayManager';
import type { Theme } from '../../utils/Theme';

export interface ButtonOptions {
    bgAlpha?: number;
    bgColor?: number;
    borderColor?: number;
    borderRadius?: number;
    borderWidth?: number;
    fontFamily?: string;
    fontSize?: number;
    height?: number;
    hoverBorderColor?: number;
    hoverColor?: number;
    label: string;
    textColor?: number;
    width?: number;
    x: number;
    y: number;
}

export function createButton(
    theme: Theme,
    overlayConfig: Required<OverlayConfig>,
    options: ButtonOptions,
    action: () => void,
): Container {
    const cfg = overlayConfig;
    const width = options.width ?? cfg.buttonWidth;
    const height = options.height ?? cfg.buttonHeight;
    const bgColor = options.bgColor ?? cfg.buttonColor;
    const bgAlpha = options.bgAlpha ?? cfg.buttonAlpha;
    const hoverColor = options.hoverColor ?? cfg.buttonHoverColor;
    const borderColor = options.borderColor ?? theme.borderColor;
    const hoverBorderColor = options.hoverBorderColor ?? theme.accentColor;
    const borderWidth = options.borderWidth ?? 2;
    const borderRadius = options.borderRadius ?? 8;

    const button = new Container();
    button.eventMode = 'static';
    button.cursor = 'pointer';

    const background = new Graphics();
    const drawNormal = () => {
        background.clear();
        background.roundRect(0, 0, width, height, borderRadius);
        background.fill({ alpha: bgAlpha, color: bgColor });
        background.stroke({ color: borderColor, width: borderWidth });
    };
    const drawHover = () => {
        background.clear();
        background.roundRect(0, 0, width, height, borderRadius);
        background.fill({ alpha: 1, color: hoverColor });
        background.stroke({ color: hoverBorderColor, width: borderWidth });
    };
    drawNormal();

    const labelText = new Text({
        style: {
            fill: options.textColor ?? cfg.textColor,
            fontFamily: options.fontFamily ?? cfg.fontFamily,
            fontSize: options.fontSize ?? cfg.fontSize,
        },
        text: options.label
    });
    labelText.anchor.set(0.5);
    labelText.position.set(width / 2, height / 2);

    button.addChild(background, labelText);
    button.position.set(options.x - width / 2, options.y);

    button.on('pointerover', drawHover);
    button.on('pointerout', drawNormal);
    button.on('pointerdown', (event: FederatedPointerEvent) => {
        event.stopPropagation();
        action();
    });

    return button;
}


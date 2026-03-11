import { Container, type FederatedPointerEvent, Graphics, Text } from 'pixi.js';

import type { OverlayConfig } from '../../managers/OverlayManager';
import type { Theme } from '../../utils/Theme';

export interface ToggleOptions {
    label: string;
    labelWidth?: number;
    onChange: (value: boolean) => void;
    value: boolean;
}

export interface ToggleResult {
    container: Container;
    toggle: () => void;
}

export function createToggle(
    theme: Theme,
    overlayConfig: Required<OverlayConfig>,
    options: ToggleOptions,
): ToggleResult {
    const cfg = overlayConfig;
    const labelWidth = options.labelWidth ?? 180;
    const toggleWidth = 60;
    const toggleHeight = 30;

    const row = new Container();

    const labelText = new Text({
        style: { fill: cfg.textColor, fontFamily: cfg.fontFamily, fontSize: cfg.fontSize - 2 },
        text: options.label
    });
    labelText.anchor.set(0, 0.5);
    labelText.position.set(0, 0);
    row.addChild(labelText);

    const toggleContainer = new Container();
    toggleContainer.eventMode = 'static';
    toggleContainer.cursor = 'pointer';
    toggleContainer.position.set(labelWidth, -toggleHeight / 2);
    row.addChild(toggleContainer);

    let on = options.value;

    const background = new Graphics();
    const knob = new Graphics();

    const draw = () => {
        background.clear();
        background.roundRect(0, 0, toggleWidth, toggleHeight, toggleHeight / 2);
        background.fill({ alpha: on ? 0.8 : 0.6, color: on ? theme.accentColor : cfg.buttonColor });
        background.stroke({ color: theme.borderColor, width: 1 });

        knob.clear();
        const knobX = on ? toggleWidth - toggleHeight / 2 : toggleHeight / 2;
        knob.circle(knobX, toggleHeight / 2, toggleHeight / 2 - 3);
        knob.fill({ alpha: 1, color: 0xFF_FF_FF });
    };

    const doToggle = () => {
        on = !on;
        options.onChange(on);
        draw();
    };

    draw();
    toggleContainer.addChild(background, knob);

    toggleContainer.on('pointerdown', (event: FederatedPointerEvent) => {
        event.stopPropagation();
        doToggle();
    });

    return { container: row, toggle: doToggle };
}


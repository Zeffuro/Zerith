import { Container, type FederatedPointerEvent, Graphics, Text } from 'pixi.js';

import type { OverlayConfig } from '../../managers/OverlayManager';
import type { Theme } from '../../utils/Theme';

export interface SliderOptions {
    label: string;
    labelWidth?: number;
    onChange: (value: number) => void;
    rowHeight?: number;
    trackWidth?: number;
    value: number;
}

export interface SliderResult {
    applyValue: (fraction: number) => void;
    container: Container;
    getValue: () => number;
}

export function createSlider(
    theme: Theme,
    overlayConfig: Required<OverlayConfig>,
    canvasWidth: number,
    options: SliderOptions,
): SliderResult {
    const cfg = overlayConfig;
    const trackWidth = options.trackWidth ?? Math.min(400, canvasWidth * 0.5);
    const labelWidth = options.labelWidth ?? 180;
    const rowHeight = options.rowHeight ?? 40;
    const sliderHeight = 8;
    const handleRadius = 12;
    const trackX = labelWidth;
    const trackY = rowHeight / 2;

    const row = new Container();

    const labelText = new Text({
        style: { fill: cfg.textColor, fontFamily: cfg.fontFamily, fontSize: cfg.fontSize - 2 },
        text: options.label
    });
    labelText.anchor.set(0, 0.5);
    labelText.position.set(0, trackY);
    row.addChild(labelText);

    const valueText = new Text({
        style: { fill: theme.accentColor, fontFamily: cfg.fontFamily, fontSize: cfg.fontSize - 4 },
        text: `${Math.round(options.value * 100)}%`
    });
    valueText.anchor.set(0, 0.5);
    valueText.position.set(trackX + trackWidth + 15, trackY);
    row.addChild(valueText);

    const trackBackground = new Graphics();
    trackBackground.roundRect(trackX, trackY - sliderHeight / 2, trackWidth, sliderHeight, 4);
    trackBackground.fill({ alpha: 0.8, color: cfg.buttonColor });
    trackBackground.stroke({ color: theme.borderColor, width: 1 });
    row.addChild(trackBackground);

    const trackFill = new Graphics();
    const drawFill = (value: number) => {
        trackFill.clear();
        const fillWidth = Math.max(1, trackWidth * value);
        trackFill.roundRect(trackX, trackY - sliderHeight / 2, fillWidth, sliderHeight, 4);
        trackFill.fill({ alpha: 0.8, color: theme.accentColor });
    };
    drawFill(options.value);
    row.addChild(trackFill);

    const handle = new Graphics();
    handle.circle(0, 0, handleRadius);
    handle.fill({ alpha: 1, color: cfg.buttonHoverColor });
    handle.stroke({ color: theme.accentColor, width: 2 });
    handle.position.set(trackX + trackWidth * options.value, trackY);
    handle.eventMode = 'static';
    handle.cursor = 'pointer';
    row.addChild(handle);

    let dragging = false;
    let currentValue = options.value;

    const applyValue = (fraction: number) => {
        const value = Math.max(0, Math.min(1, fraction));
        currentValue = value;
        options.onChange(value);
        handle.x = trackX + trackWidth * value;
        drawFill(value);
        valueText.text = `${Math.round(value * 100)}%`;
    };

    const hitArea = new Graphics();
    hitArea.rect(trackX - handleRadius, 0, trackWidth + handleRadius * 2, rowHeight);
    hitArea.fill({ alpha: 0.001, color: 0x00_00_00 });
    hitArea.eventMode = 'static';
    hitArea.cursor = 'pointer';
    row.addChild(hitArea);

    hitArea.on('pointerdown', (event: FederatedPointerEvent) => {
        event.stopPropagation();
        dragging = true;
        const rowWorldX = row.getGlobalPosition().x;
        const fraction = (event.global.x - rowWorldX - trackX) / trackWidth;
        applyValue(fraction);
    });

    handle.on('pointerdown', (event: FederatedPointerEvent) => {
        event.stopPropagation();
        dragging = true;
    });

    const onGlobalPointerMove = (event: FederatedPointerEvent) => {
        if (!dragging) return;
        const rowWorldX = row.getGlobalPosition().x;
        const fraction = (event.global.x - rowWorldX - trackX) / trackWidth;
        applyValue(fraction);
    };

    const onGlobalPointerUp = () => {
        dragging = false;
    };

    hitArea.on('globalpointermove', onGlobalPointerMove);
    hitArea.on('globalpointerup', onGlobalPointerUp);
    hitArea.on('globalpointerupoutside', onGlobalPointerUp);

    return {
        applyValue,
        container: row,
        getValue: () => currentValue,
    };
}


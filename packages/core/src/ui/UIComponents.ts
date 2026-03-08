import { Container, type FederatedPointerEvent, Graphics, Text } from 'pixi.js';

import type { OverlayConfig } from '../managers/OverlayManager';
import type { Theme } from '../utils/Theme';
import type { PanelFocusManager } from './PanelFocusManager';

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

/* Button */

export interface ListRowOptions {
    initialSelected?: number;
    items: { label: string; onSelect: (index: number) => void }[];
    rowHeight?: number;
    rowSpacing?: number;
    width: number;
}

export interface ListRowResult {
    container: Container;
    select: (index: number) => void;
}

/* Slider */

export interface SliderOptions {
    label: string;
    labelWidth?: number;
    onChange: (value: number) => void;
    rowHeight?: number;
    trackWidth?: number;
    value: number;
}

export interface SliderResult {
    /** Programmatically set the slider to a 0–1 fraction */
    applyValue: (fraction: number) => void;
    cleanup: () => void;
    container: Container;
    /** Get the current 0–1 value */
    getValue: () => number;
}

export interface ToggleOptions {
    label: string;
    labelWidth?: number;
    onChange: (value: boolean) => void;
    value: boolean;
}

/* Toggle */

export interface ToggleResult {
    container: Container;
    toggle: () => void;
}

export interface UIContext {
    canvasHeight: number;
    canvasWidth: number;
    getCanvasRect: () => DOMRect;
    overlayConfig: Required<OverlayConfig>;
    theme: Theme;
}

export function createButton(context: UIContext, options: ButtonOptions, action: () => void): Container {
    const cfg = context.overlayConfig;
    const w = options.width ?? cfg.buttonWidth;
    const h = options.height ?? cfg.buttonHeight;
    const bgColor = options.bgColor ?? cfg.buttonColor;
    const bgAlpha = options.bgAlpha ?? cfg.buttonAlpha;
    const hoverColor = options.hoverColor ?? cfg.buttonHoverColor;
    const borderColor = options.borderColor ?? context.theme.borderColor;
    const hoverBorderColor = options.hoverBorderColor ?? context.theme.accentColor;
    const borderWidth = options.borderWidth ?? 2;
    const borderRadius = options.borderRadius ?? 8;

    const button = new Container();
    button.eventMode = 'static';
    button.cursor = 'pointer';

    const bg = new Graphics();
    const drawNormal = () => {
        bg.clear();
        bg.roundRect(0, 0, w, h, borderRadius);
        bg.fill({ alpha: bgAlpha, color: bgColor });
        bg.stroke({ color: borderColor, width: borderWidth });
    };
    const drawHover = () => {
        bg.clear();
        bg.roundRect(0, 0, w, h, borderRadius);
        bg.fill({ alpha: 1, color: hoverColor });
        bg.stroke({ color: hoverBorderColor, width: borderWidth });
    };
    drawNormal();

    const txt = new Text({
        style: {
            fill: options.textColor ?? cfg.textColor,
            fontFamily: options.fontFamily ?? cfg.fontFamily,
            fontSize: options.fontSize ?? cfg.fontSize,
        },
        text: options.label
    });
    txt.anchor.set(0.5);
    txt.position.set(w / 2, h / 2);

    button.addChild(bg, txt);
    button.position.set(options.x - w / 2, options.y);

    button.on('pointerover', drawHover);
    button.on('pointerout', drawNormal);
    button.on('pointerdown', (event: FederatedPointerEvent) => {
        event.stopPropagation();
        action();
    });

    return button;
}

/* Panel Title */

export function createPanelTitle(context: UIContext, text: string): Text {
    const cfg = context.overlayConfig;
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
    title.position.set(context.canvasWidth / 2, 20);
    return title;
}

/* Selectable Row List */

export function createSelectableList(context: UIContext, options: ListRowOptions): ListRowResult {
    const cfg = context.overlayConfig;
    const rowHeight = options.rowHeight ?? 45;
    const rowSpacing = options.rowSpacing ?? 4;
    const listW = options.width;

    const content = new Container();
    const rowBgs: Graphics[] = [];
    let selectedIndex = options.initialSelected ?? 0;

    const styleRow = (bg: Graphics, selected: boolean) => {
        bg.clear();
        bg.roundRect(0, 0, listW, rowHeight, 6);
        bg.fill({
            alpha: selected ? 1 : cfg.buttonAlpha,
            color: selected ? cfg.buttonHoverColor : cfg.buttonColor
        });
        bg.stroke({
            color: selected ? context.theme.accentColor : context.theme.borderColor,
            width: selected ? 2 : 1
        });
    };

    const select = (index: number) => {
        if (rowBgs[selectedIndex]) styleRow(rowBgs[selectedIndex], false);
        selectedIndex = index;
        if (rowBgs[selectedIndex]) styleRow(rowBgs[selectedIndex], true);
    };

    let y = 0;
    for (const [index, item] of options.items.entries()) {
        const row = new Container();
        row.eventMode = 'static';
        row.cursor = 'pointer';

        const rowBg = new Graphics();
        styleRow(rowBg, index === selectedIndex);
        rowBgs.push(rowBg);

        const rowText = new Text({
            style: { fill: cfg.textColor, fontFamily: cfg.fontFamily, fontSize: cfg.fontSize - 4 },
            text: item.label
        });
        rowText.anchor.set(0, 0.5);
        rowText.position.set(12, rowHeight / 2);

        row.addChild(rowBg, rowText);
        row.position.set(0, y);

        row.on('pointerover', () => {
            if (index !== selectedIndex) {
                rowBg.clear();
                rowBg.roundRect(0, 0, listW, rowHeight, 6);
                rowBg.fill({ alpha: 0.6, color: cfg.buttonHoverColor });
                rowBg.stroke({ color: context.theme.accentColor, width: 1 });
            }
        });
        row.on('pointerout', () => {
            if (index !== selectedIndex) styleRow(rowBg, false);
        });
        row.on('pointerdown', (event: FederatedPointerEvent) => {
            event.stopPropagation();
            select(index);
            item.onSelect(index);
        });

        content.addChild(row);
        y += rowHeight + rowSpacing;
    }

    return { container: content, select };
}

export function createSlider(context: UIContext, options: SliderOptions): SliderResult {
    const cfg = context.overlayConfig;
    const trackWidth = options.trackWidth ?? Math.min(400, context.canvasWidth * 0.5);
    const labelWidth = options.labelWidth ?? 180;
    const rowHeight = options.rowHeight ?? 40;
    const sliderHeight = 8;
    const handleRadius = 12;
    const trackX = labelWidth;
    const trackY = rowHeight / 2;

    const row = new Container();

    // Label
    const labelText = new Text({
        style: { fill: cfg.textColor, fontFamily: cfg.fontFamily, fontSize: cfg.fontSize - 2 },
        text: options.label
    });
    labelText.anchor.set(0, 0.5);
    labelText.position.set(0, trackY);
    row.addChild(labelText);

    // Value display
    const valueText = new Text({
        style: { fill: context.theme.accentColor, fontFamily: cfg.fontFamily, fontSize: cfg.fontSize - 4 },
        text: `${Math.round(options.value * 100)}%`
    });
    valueText.anchor.set(0, 0.5);
    valueText.position.set(trackX + trackWidth + 15, trackY);
    row.addChild(valueText);

    // Track background
    const trackBg = new Graphics();
    trackBg.roundRect(trackX, trackY - sliderHeight / 2, trackWidth, sliderHeight, 4);
    trackBg.fill({ alpha: 0.8, color: cfg.buttonColor });
    trackBg.stroke({ color: context.theme.borderColor, width: 1 });
    row.addChild(trackBg);

    // Track fill
    const trackFill = new Graphics();
    const drawFill = (value: number) => {
        trackFill.clear();
        const fillWidth = Math.max(1, trackWidth * value);
        trackFill.roundRect(trackX, trackY - sliderHeight / 2, fillWidth, sliderHeight, 4);
        trackFill.fill({ alpha: 0.8, color: context.theme.accentColor });
    };
    drawFill(options.value);
    row.addChild(trackFill);

    // Handle
    const handle = new Graphics();
    handle.circle(0, 0, handleRadius);
    handle.fill({ alpha: 1, color: cfg.buttonHoverColor });
    handle.stroke({ color: context.theme.accentColor, width: 2 });
    handle.position.set(trackX + trackWidth * options.value, trackY);
    handle.eventMode = 'static';
    handle.cursor = 'pointer';
    row.addChild(handle);

    // State
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

    // Hit area over track
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

    const onMouseMove = (event: MouseEvent) => {
        if (!dragging) return;
        const rect = context.getCanvasRect();
        const scaleX = context.canvasWidth / rect.width;
        const canvasX = (event.clientX - rect.left) * scaleX;
        const rowWorldX = row.getGlobalPosition().x;
        const fraction = (canvasX - rowWorldX - trackX) / trackWidth;
        applyValue(fraction);
    };

    const onMouseUp = () => {
        dragging = false;
    };

    globalThis.addEventListener('mousemove', onMouseMove);
    globalThis.addEventListener('mouseup', onMouseUp);

    return {
        applyValue,
        cleanup: () => {
            globalThis.removeEventListener('mousemove', onMouseMove);
            globalThis.removeEventListener('mouseup', onMouseUp);
        },
        container: row,
        getValue: () => currentValue,
    };
}

export function createToggle(context: UIContext, options: ToggleOptions): ToggleResult {
    const cfg = context.overlayConfig;
    const labelWidth = options.labelWidth ?? 180;
    const toggleW = 60;
    const toggleH = 30;

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
    toggleContainer.position.set(labelWidth, -toggleH / 2);
    row.addChild(toggleContainer);

    let on = options.value;

    const bg = new Graphics();
    const knob = new Graphics();

    const draw = () => {
        bg.clear();
        bg.roundRect(0, 0, toggleW, toggleH, toggleH / 2);
        bg.fill({ alpha: on ? 0.8 : 0.6, color: on ? context.theme.accentColor : cfg.buttonColor });
        bg.stroke({ color: context.theme.borderColor, width: 1 });

        knob.clear();
        const knobX = on ? toggleW - toggleH / 2 : toggleH / 2;
        knob.circle(knobX, toggleH / 2, toggleH / 2 - 3);
        knob.fill({ alpha: 1, color: 0xFF_FF_FF });
    };

    const doToggle = () => {
        on = !on;
        options.onChange(on);
        draw();
    };

    draw();
    toggleContainer.addChild(bg, knob);

    toggleContainer.on('pointerdown', (event: FederatedPointerEvent) => {
        event.stopPropagation();
        doToggle();
    });

    return { container: row, toggle: doToggle };
}

export function registerFocusableButton(
    context: UIContext,
    focus: PanelFocusManager,
    button: Container,
    action: () => void,
    options?: { height?: number; width?: number; }
) {
    const cfg = context.overlayConfig;
    const bg = button.children[0] as Graphics;
    const w = options?.width ?? cfg.buttonWidth;
    const h = options?.height ?? cfg.buttonHeight;

    focus.register({
        activate: action,
        blur: () => {
            bg.clear();
            bg.roundRect(0, 0, w, h, 8);
            bg.fill({ alpha: cfg.buttonAlpha, color: cfg.buttonColor });
            bg.stroke({ color: context.theme.borderColor, width: 2 });
        },
        focus: () => {
            bg.clear();
            bg.roundRect(0, 0, w, h, 8);
            bg.fill({ alpha: 1, color: cfg.buttonHoverColor });
            bg.stroke({ color: context.theme.accentColor, width: 2 });
        },
    });
}
import { Container, Graphics, Text } from 'pixi.js';
import type { Theme } from '../utils/Theme';
import type { OverlayConfig } from '../managers/OverlayManager';
import type { PanelFocusManager } from './PanelFocusManager';

export interface UIContext {
    theme: Theme;
    overlayConfig: Required<OverlayConfig>;
    canvasWidth: number;
    canvasHeight: number;
    getCanvasRect: () => DOMRect;
}

/* Button */

export interface ButtonOptions {
    label: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    fontSize?: number;
    fontFamily?: string;
    textColor?: number;
    bgColor?: number;
    bgAlpha?: number;
    hoverColor?: number;
    borderColor?: number;
    hoverBorderColor?: number;
    borderWidth?: number;
    borderRadius?: number;
}

export function createButton(ctx: UIContext, opts: ButtonOptions, action: () => void): Container {
    const cfg = ctx.overlayConfig;
    const w = opts.width ?? cfg.buttonWidth;
    const h = opts.height ?? cfg.buttonHeight;
    const bgColor = opts.bgColor ?? cfg.buttonColor;
    const bgAlpha = opts.bgAlpha ?? cfg.buttonAlpha;
    const hoverColor = opts.hoverColor ?? cfg.buttonHoverColor;
    const borderColor = opts.borderColor ?? ctx.theme.borderColor;
    const hoverBorderColor = opts.hoverBorderColor ?? ctx.theme.accentColor;
    const borderWidth = opts.borderWidth ?? 2;
    const borderRadius = opts.borderRadius ?? 8;

    const btn = new Container();
    btn.eventMode = 'static';
    btn.cursor = 'pointer';

    const bg = new Graphics();
    const drawNormal = () => {
        bg.clear();
        bg.roundRect(0, 0, w, h, borderRadius);
        bg.fill({ color: bgColor, alpha: bgAlpha });
        bg.stroke({ color: borderColor, width: borderWidth });
    };
    const drawHover = () => {
        bg.clear();
        bg.roundRect(0, 0, w, h, borderRadius);
        bg.fill({ color: hoverColor, alpha: 1 });
        bg.stroke({ color: hoverBorderColor, width: borderWidth });
    };
    drawNormal();

    const txt = new Text({
        text: opts.label,
        style: {
            fill: opts.textColor ?? cfg.textColor,
            fontSize: opts.fontSize ?? cfg.fontSize,
            fontFamily: opts.fontFamily ?? cfg.fontFamily,
        }
    });
    txt.anchor.set(0.5);
    txt.position.set(w / 2, h / 2);

    btn.addChild(bg, txt);
    btn.position.set(opts.x - w / 2, opts.y);

    btn.on('pointerover', drawHover);
    btn.on('pointerout', drawNormal);
    btn.on('pointerdown', (e: any) => {
        e.stopPropagation();
        action();
    });

    return btn;
}

/* Slider */

export interface SliderOptions {
    label: string;
    value: number;
    trackWidth?: number;
    labelWidth?: number;
    rowHeight?: number;
    onChange: (value: number) => void;
}

export interface SliderResult {
    container: Container;
    cleanup: () => void;
    /** Programmatically set the slider to a 0–1 fraction */
    applyValue: (fraction: number) => void;
    /** Get the current 0–1 value */
    getValue: () => number;
}

export function createSlider(ctx: UIContext, opts: SliderOptions): SliderResult {
    const cfg = ctx.overlayConfig;
    const trackWidth = opts.trackWidth ?? Math.min(400, ctx.canvasWidth * 0.5);
    const labelWidth = opts.labelWidth ?? 180;
    const rowHeight = opts.rowHeight ?? 40;
    const sliderHeight = 8;
    const handleRadius = 12;
    const trackX = labelWidth;
    const trackY = rowHeight / 2;

    const row = new Container();

    // Label
    const labelText = new Text({
        text: opts.label,
        style: { fill: cfg.textColor, fontSize: cfg.fontSize - 2, fontFamily: cfg.fontFamily }
    });
    labelText.anchor.set(0, 0.5);
    labelText.position.set(0, trackY);
    row.addChild(labelText);

    // Value display
    const valueText = new Text({
        text: `${Math.round(opts.value * 100)}%`,
        style: { fill: ctx.theme.accentColor, fontSize: cfg.fontSize - 4, fontFamily: cfg.fontFamily }
    });
    valueText.anchor.set(0, 0.5);
    valueText.position.set(trackX + trackWidth + 15, trackY);
    row.addChild(valueText);

    // Track background
    const trackBg = new Graphics();
    trackBg.roundRect(trackX, trackY - sliderHeight / 2, trackWidth, sliderHeight, 4);
    trackBg.fill({ color: cfg.buttonColor, alpha: 0.8 });
    trackBg.stroke({ color: ctx.theme.borderColor, width: 1 });
    row.addChild(trackBg);

    // Track fill
    const trackFill = new Graphics();
    const drawFill = (val: number) => {
        trackFill.clear();
        const fillWidth = Math.max(1, trackWidth * val);
        trackFill.roundRect(trackX, trackY - sliderHeight / 2, fillWidth, sliderHeight, 4);
        trackFill.fill({ color: ctx.theme.accentColor, alpha: 0.8 });
    };
    drawFill(opts.value);
    row.addChild(trackFill);

    // Handle
    const handle = new Graphics();
    handle.circle(0, 0, handleRadius);
    handle.fill({ color: cfg.buttonHoverColor, alpha: 1 });
    handle.stroke({ color: ctx.theme.accentColor, width: 2 });
    handle.position.set(trackX + trackWidth * opts.value, trackY);
    handle.eventMode = 'static';
    handle.cursor = 'pointer';
    row.addChild(handle);

    // State
    let dragging = false;
    let currentValue = opts.value;

    const applyValue = (fraction: number) => {
        const val = Math.max(0, Math.min(1, fraction));
        currentValue = val;
        opts.onChange(val);
        handle.x = trackX + trackWidth * val;
        drawFill(val);
        valueText.text = `${Math.round(val * 100)}%`;
    };

    // Hit area over track
    const hitArea = new Graphics();
    hitArea.rect(trackX - handleRadius, 0, trackWidth + handleRadius * 2, rowHeight);
    hitArea.fill({ color: 0x000000, alpha: 0.001 });
    hitArea.eventMode = 'static';
    hitArea.cursor = 'pointer';
    row.addChild(hitArea);

    hitArea.on('pointerdown', (e: any) => {
        e.stopPropagation();
        dragging = true;
        const rowWorldX = row.getGlobalPosition().x;
        const fraction = (e.global.x - rowWorldX - trackX) / trackWidth;
        applyValue(fraction);
    });

    handle.on('pointerdown', (e: any) => {
        e.stopPropagation();
        dragging = true;
    });

    const onMouseMove = (e: MouseEvent) => {
        if (!dragging) return;
        const rect = ctx.getCanvasRect();
        const scaleX = ctx.canvasWidth / rect.width;
        const canvasX = (e.clientX - rect.left) * scaleX;
        const rowWorldX = row.getGlobalPosition().x;
        const fraction = (canvasX - rowWorldX - trackX) / trackWidth;
        applyValue(fraction);
    };

    const onMouseUp = () => {
        dragging = false;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return {
        container: row,
        cleanup: () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        },
        applyValue,
        getValue: () => currentValue,
    };
}

/* Toggle */

export interface ToggleOptions {
    label: string;
    value: boolean;
    labelWidth?: number;
    onChange: (value: boolean) => void;
}

export interface ToggleResult {
    container: Container;
    toggle: () => void;
}

export function createToggle(ctx: UIContext, opts: ToggleOptions): ToggleResult {
    const cfg = ctx.overlayConfig;
    const labelWidth = opts.labelWidth ?? 180;
    const toggleW = 60;
    const toggleH = 30;

    const row = new Container();

    const labelText = new Text({
        text: opts.label,
        style: { fill: cfg.textColor, fontSize: cfg.fontSize - 2, fontFamily: cfg.fontFamily }
    });
    labelText.anchor.set(0, 0.5);
    labelText.position.set(0, 0);
    row.addChild(labelText);

    const toggleContainer = new Container();
    toggleContainer.eventMode = 'static';
    toggleContainer.cursor = 'pointer';
    toggleContainer.position.set(labelWidth, -toggleH / 2);
    row.addChild(toggleContainer);

    let on = opts.value;

    const bg = new Graphics();
    const knob = new Graphics();

    const draw = () => {
        bg.clear();
        bg.roundRect(0, 0, toggleW, toggleH, toggleH / 2);
        bg.fill({ color: on ? ctx.theme.accentColor : cfg.buttonColor, alpha: on ? 0.8 : 0.6 });
        bg.stroke({ color: ctx.theme.borderColor, width: 1 });

        knob.clear();
        const knobX = on ? toggleW - toggleH / 2 : toggleH / 2;
        knob.circle(knobX, toggleH / 2, toggleH / 2 - 3);
        knob.fill({ color: 0xffffff, alpha: 1 });
    };

    const doToggle = () => {
        on = !on;
        opts.onChange(on);
        draw();
    };

    draw();
    toggleContainer.addChild(bg, knob);

    toggleContainer.on('pointerdown', (e: any) => {
        e.stopPropagation();
        doToggle();
    });

    return { container: row, toggle: doToggle };
}

/* Panel Title */

export function createPanelTitle(ctx: UIContext, text: string): Text {
    const cfg = ctx.overlayConfig;
    const title = new Text({
        text,
        style: {
            fill: cfg.textColor,
            fontSize: cfg.fontSize + 6,
            fontFamily: cfg.fontFamily,
            fontWeight: 'bold'
        }
    });
    title.anchor.set(0.5, 0);
    title.position.set(ctx.canvasWidth / 2, 20);
    return title;
}

/* Selectable Row List */

export interface ListRowOptions {
    items: { label: string; onSelect: (index: number) => void }[];
    width: number;
    rowHeight?: number;
    rowSpacing?: number;
    initialSelected?: number;
}

export interface ListRowResult {
    container: Container;
    select: (index: number) => void;
}

export function createSelectableList(ctx: UIContext, opts: ListRowOptions): ListRowResult {
    const cfg = ctx.overlayConfig;
    const rowHeight = opts.rowHeight ?? 45;
    const rowSpacing = opts.rowSpacing ?? 4;
    const listW = opts.width;

    const content = new Container();
    const rowBgs: Graphics[] = [];
    let selectedIndex = opts.initialSelected ?? 0;

    const styleRow = (bg: Graphics, selected: boolean) => {
        bg.clear();
        bg.roundRect(0, 0, listW, rowHeight, 6);
        bg.fill({
            color: selected ? cfg.buttonHoverColor : cfg.buttonColor,
            alpha: selected ? 1 : cfg.buttonAlpha
        });
        bg.stroke({
            color: selected ? ctx.theme.accentColor : ctx.theme.borderColor,
            width: selected ? 2 : 1
        });
    };

    const select = (index: number) => {
        if (rowBgs[selectedIndex]) styleRow(rowBgs[selectedIndex], false);
        selectedIndex = index;
        if (rowBgs[selectedIndex]) styleRow(rowBgs[selectedIndex], true);
    };

    let y = 0;
    opts.items.forEach((item, index) => {
        const row = new Container();
        row.eventMode = 'static';
        row.cursor = 'pointer';

        const rowBg = new Graphics();
        styleRow(rowBg, index === selectedIndex);
        rowBgs.push(rowBg);

        const rowText = new Text({
            text: item.label,
            style: { fill: cfg.textColor, fontSize: cfg.fontSize - 4, fontFamily: cfg.fontFamily }
        });
        rowText.anchor.set(0, 0.5);
        rowText.position.set(12, rowHeight / 2);

        row.addChild(rowBg, rowText);
        row.position.set(0, y);

        row.on('pointerover', () => {
            if (index !== selectedIndex) {
                rowBg.clear();
                rowBg.roundRect(0, 0, listW, rowHeight, 6);
                rowBg.fill({ color: cfg.buttonHoverColor, alpha: 0.6 });
                rowBg.stroke({ color: ctx.theme.accentColor, width: 1 });
            }
        });
        row.on('pointerout', () => {
            if (index !== selectedIndex) styleRow(rowBg, false);
        });
        row.on('pointerdown', (e: any) => {
            e.stopPropagation();
            select(index);
            item.onSelect(index);
        });

        content.addChild(row);
        y += rowHeight + rowSpacing;
    });

    return { container: content, select };
}

export function registerFocusableButton(
    ctx: UIContext,
    focus: PanelFocusManager,
    btn: Container,
    action: () => void,
    opts?: { width?: number; height?: number }
) {
    const cfg = ctx.overlayConfig;
    const bg = btn.children[0] as Graphics;
    const w = opts?.width ?? cfg.buttonWidth;
    const h = opts?.height ?? cfg.buttonHeight;

    focus.register({
        focus: () => {
            bg.clear();
            bg.roundRect(0, 0, w, h, 8);
            bg.fill({ color: cfg.buttonHoverColor, alpha: 1 });
            bg.stroke({ color: ctx.theme.accentColor, width: 2 });
        },
        blur: () => {
            bg.clear();
            bg.roundRect(0, 0, w, h, 8);
            bg.fill({ color: cfg.buttonColor, alpha: cfg.buttonAlpha });
            bg.stroke({ color: ctx.theme.borderColor, width: 2 });
        },
        activate: action,
    });
}
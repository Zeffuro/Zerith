import { Container, type FederatedPointerEvent, Graphics, Text } from 'pixi.js';

import type { OverlayConfig } from '../../managers/OverlayManager';
import type { Theme } from '../../utils/Theme';

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

export function createSelectableList(
    theme: Theme,
    overlayConfig: Required<OverlayConfig>,
    options: ListRowOptions,
): ListRowResult {
    const cfg = overlayConfig;
    const rowHeight = options.rowHeight ?? 45;
    const rowSpacing = options.rowSpacing ?? 4;
    const listWidth = options.width;

    const content = new Container();
    const rowBackgrounds: Graphics[] = [];
    let selectedIndex = options.initialSelected ?? 0;

    const styleRow = (background: Graphics, selected: boolean) => {
        background.clear();
        background.roundRect(0, 0, listWidth, rowHeight, 6);
        background.fill({
            alpha: selected ? 1 : cfg.buttonAlpha,
            color: selected ? cfg.buttonHoverColor : cfg.buttonColor
        });
        background.stroke({
            color: selected ? theme.accentColor : theme.borderColor,
            width: selected ? 2 : 1
        });
    };

    const select = (index: number) => {
        if (rowBackgrounds[selectedIndex]) styleRow(rowBackgrounds[selectedIndex], false);
        selectedIndex = index;
        if (rowBackgrounds[selectedIndex]) styleRow(rowBackgrounds[selectedIndex], true);
    };

    let yPosition = 0;
    for (const [index, item] of options.items.entries()) {
        const row = new Container();
        row.eventMode = 'static';
        row.cursor = 'pointer';

        const rowBackground = new Graphics();
        styleRow(rowBackground, index === selectedIndex);
        rowBackgrounds.push(rowBackground);

        const rowText = new Text({
            style: { fill: cfg.textColor, fontFamily: cfg.fontFamily, fontSize: cfg.fontSize - 4 },
            text: item.label
        });
        rowText.anchor.set(0, 0.5);
        rowText.position.set(12, rowHeight / 2);

        row.addChild(rowBackground, rowText);
        row.position.set(0, yPosition);

        row.on('pointerover', () => {
            if (index !== selectedIndex) {
                rowBackground.clear();
                rowBackground.roundRect(0, 0, listWidth, rowHeight, 6);
                rowBackground.fill({ alpha: 0.6, color: cfg.buttonHoverColor });
                rowBackground.stroke({ color: theme.accentColor, width: 1 });
            }
        });
        row.on('pointerout', () => {
            if (index !== selectedIndex) styleRow(rowBackground, false);
        });
        row.on('pointerdown', (event: FederatedPointerEvent) => {
            event.stopPropagation();
            select(index);
            item.onSelect(index);
        });

        content.addChild(row);
        yPosition += rowHeight + rowSpacing;
    }

    return { container: content, select };
}


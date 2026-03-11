import { Container, Text } from 'pixi.js';

import type { EvidenceItem } from '../managers/EvidenceManager';
import type { OverlayConfig } from '../managers/OverlayManager';
import type { Theme } from '../utils/Theme';
import type { PanelFocusManager } from './PanelFocusManager';

import { createSelectableList } from './UIComponents';

export interface ItemCardListOptions {
    emptyText: string;
    focus: PanelFocusManager;
    items: EvidenceItem[];
    listWidth: number;
    onSelect: (index: number) => void;
    overlayConfig: Required<OverlayConfig>;
    theme: Theme;
}

export function createItemCardList(options: ItemCardListOptions): Container {
    const { emptyText, focus, items, listWidth, onSelect, overlayConfig, theme } = options;

    if (items.length === 0) {
        const empty = new Text({
            style: { fill: 0x88_88_88, fontFamily: overlayConfig.fontFamily, fontSize: overlayConfig.fontSize - 4 },
            text: emptyText
        });
        empty.position.set(0, 10);

        const emptyContainer = new Container();
        emptyContainer.addChild(empty);
        return emptyContainer;
    }

    const { container, select } = createSelectableList(theme, overlayConfig, {
        initialSelected: 0,
        items: items.map((item) => ({
            label: item.name,
            onSelect,
        })),
        width: listWidth - 10,
    });

    for (const [index] of items.entries()) {
        focus.register({
            activate: () => {
                onSelect(index);
            },
            blur: () => {},
            focus: () => {
                select(index);
                onSelect(index);
            },
        });
    }

    return container;
}


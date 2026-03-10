import { Container, type FederatedPointerEvent, Graphics, Text } from 'pixi.js';

import type { IDisplayManager, IHistoryManager } from '../interfaces/managers';
import type { OverlayConfig } from '../managers/OverlayManager';
import type { MenuPanel } from '../types';
import type { Theme } from '../utils/Theme';

import type { PanelFocusManager } from './PanelFocusManager';

import { createButton, createPanelTitle, registerFocusableButton } from './UIComponents';

export interface HistoryPanelConfig {
    maxLines?: number;
}

export class HistoryPanel implements MenuPanel {
    public id = 'history';
    public label = 'History';
    private config: Required<HistoryPanelConfig>;
    private readonly history: Pick<IHistoryManager, 'getRecent'>;

    constructor(
        history: Pick<IHistoryManager, 'getRecent'>,
        config: HistoryPanelConfig = {},
    ) {
        this.history = history;
        this.config = { maxLines: 50, ...config };
    }

    build(
        display: Pick<IDisplayManager, 'height' | 'width'> & { canvasElement: HTMLCanvasElement; },
        theme: Theme,
        overlayConfig: Required<OverlayConfig>,
        focus: PanelFocusManager,
        onClose: () => void,
    ) {
        const cfg = overlayConfig;
        const w = display.width;
        const h = display.height;

        const root = new Container();
        root.eventMode = 'static';
        const bg = new Graphics()
            .rect(0, 0, w, h)
            .fill({ alpha: 0.95, color: cfg.backgroundColor });
        bg.eventMode = 'static';
        bg.on('pointerdown', (event: FederatedPointerEvent) => event.stopPropagation());
        root.addChild(bg);
        root.addChild(createPanelTitle(cfg, w, 'HISTORY'));

        const entries = this.history.getRecent(this.config.maxLines);
        const padding = 40;
        const lineHeight = 30;
        const backMargin = 20;
        const backHeight = cfg.buttonHeight;
        const contentAreaBottom = h - backHeight - backMargin * 2;
        let y = 70;

        const content = new Container();

        const mask = new Graphics().rect(0, 60, w, contentAreaBottom - 60).fill(0xFF_FF_FF);
        root.addChild(mask);
        content.mask = mask;

        if (entries.length === 0) {
            const empty = new Text({
                style: { fill: 0x88_88_88, fontFamily: cfg.fontFamily, fontSize: cfg.fontSize - 4 },
                text: 'No dialogue history yet.'
            });
            empty.position.set(padding, y);
            content.addChild(empty);
        } else {
            for (const entry of entries) {
                const speakerText = new Text({
                    style: {
                        fill: theme.accentColor,
                        fontFamily: cfg.fontFamily,
                        fontSize: cfg.fontSize - 4,
                        fontWeight: 'bold'
                    },
                    text: `${entry.speaker}:`
                });
                speakerText.position.set(padding, y);
                content.addChild(speakerText);

                const cleanText = entry.text.replaceAll(/{[^}]+}/g, '').replaceAll(/<[^>]+>/g, '');
                const messageText = new Text({
                    style: {
                        fill: cfg.textColor,
                        fontFamily: cfg.fontFamily,
                        fontSize: cfg.fontSize - 4,
                        wordWrap: true,
                        wordWrapWidth: w - (padding * 2) - 10
                    },
                    text: cleanText
                });
                messageText.position.set(padding + 10, y + lineHeight);
                content.addChild(messageText);

                y += lineHeight + messageText.height + 10;
            }
        }

        root.addChild(content);

        const maxScroll = Math.max(0, y - contentAreaBottom + 60);
        let scrollY = -maxScroll;
        content.y = scrollY;

        const scrollStep = 40;

        const applyScroll = (delta: number) => {
            scrollY += delta;
            scrollY = Math.max(-maxScroll, Math.min(0, scrollY));
            content.y = scrollY;
        };

        // Mouse wheel
        const onWheel = (event: WheelEvent) => {
            event.preventDefault();
            applyScroll(-event.deltaY);
        };
        display.canvasElement.addEventListener('wheel', onWheel, { passive: false });

        // Keyboard/gamepad scroll via navigate
        focus.onNavigateRaw = (direction: 'down' | 'left' | 'right' | 'up') => {
            if (direction === 'up') {
                applyScroll(scrollStep);
                return true;
            }
            if (direction === 'down') {
                applyScroll(-scrollStep);
                return true;
            }
            return false;
        };

        const backButton = createButton(theme, cfg, { label: 'Back', x: w / 2, y: h - backHeight - backMargin }, onClose);
        root.addChild(backButton);

        registerFocusableButton(theme, cfg, focus, backButton, onClose);

        return {
            cleanup: () => display.canvasElement.removeEventListener('wheel', onWheel),
            container: root,
        };
    }
}
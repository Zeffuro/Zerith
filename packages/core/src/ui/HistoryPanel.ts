import { Container, Graphics, Text } from 'pixi.js';

import type { Engine } from '../Engine';
import type { MenuPanel } from '../types';

import { createButton, createPanelTitle, registerFocusableButton } from './UIComponents';

export interface HistoryPanelConfig {
    maxLines?: number;
}

export class HistoryPanel implements MenuPanel {
    public id = 'history';
    public label = 'History';
    private config: Required<HistoryPanelConfig>;

    constructor(config: HistoryPanelConfig = {}) {
        this.config = { maxLines: 50, ...config };
    }

    build(engine: Engine, onClose: () => void) {
        const overlay = engine.overlay;
        const context = overlay.getUIContext();
        const cfg = context.overlayConfig;
        const w = context.canvasWidth;
        const h = context.canvasHeight;
        const focus = overlay.focus;

        const root = overlay.createPanelBase();
        root.addChild(createPanelTitle(context, 'HISTORY'));

        const entries = engine.history.getRecent(this.config.maxLines);
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
                        fill: context.theme.accentColor,
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
        engine.app.canvas.addEventListener('wheel', onWheel, { passive: false });

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

        const backButton = createButton(context, { label: 'Back', x: w / 2, y: h - backHeight - backMargin }, onClose);
        root.addChild(backButton);

        registerFocusableButton(context, focus, backButton, onClose);

        return {
            cleanup: () => engine.app.canvas.removeEventListener('wheel', onWheel),
            container: root,
        };
    }
}
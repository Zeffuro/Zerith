import { Container, Text } from 'pixi.js';
import type { Engine } from '../Engine';
import type { MenuPanel } from '../types';
import { createPanelTitle, createButton } from './UIComponents';

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
        const ctx = overlay.getUIContext();
        const cfg = ctx.overlayConfig;
        const w = ctx.canvasWidth;
        const h = ctx.canvasHeight;

        const root = overlay.createPanelBase();
        root.addChild(createPanelTitle(ctx, 'HISTORY'));

        const entries = engine.history.getRecent(this.config.maxLines);
        const padding = 40;
        const lineHeight = 30;
        let y = 70;

        const content = new Container();

        if (entries.length === 0) {
            const empty = new Text({
                text: 'No dialogue history yet.',
                style: { fill: 0x888888, fontSize: cfg.fontSize - 4, fontFamily: cfg.fontFamily }
            });
            empty.position.set(padding, y);
            content.addChild(empty);
        } else {
            entries.forEach((entry) => {
                const speakerText = new Text({
                    text: `${entry.speaker}:`,
                    style: {
                        fill: ctx.theme.accentColor,
                        fontSize: cfg.fontSize - 4,
                        fontFamily: cfg.fontFamily,
                        fontWeight: 'bold'
                    }
                });
                speakerText.position.set(padding, y);
                content.addChild(speakerText);

                const cleanText = entry.text.replace(/{[^}]+}/g, '').replace(/<[^>]+>/g, '');
                const msgText = new Text({
                    text: cleanText,
                    style: {
                        fill: cfg.textColor,
                        fontSize: cfg.fontSize - 4,
                        fontFamily: cfg.fontFamily,
                        wordWrap: true,
                        wordWrapWidth: w - (padding * 2) - 10
                    }
                });
                msgText.position.set(padding + 10, y + lineHeight);
                content.addChild(msgText);

                y += lineHeight + msgText.height + 10;
            });
        }

        root.addChild(content);

        const maxScroll = Math.max(0, y - h + 80);
        let scrollY = -maxScroll;
        content.y = scrollY;

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            scrollY -= e.deltaY;
            scrollY = Math.max(-maxScroll, Math.min(0, scrollY));
            content.y = scrollY;
        };
        engine.app.canvas.addEventListener('wheel', onWheel, { passive: false });

        root.addChild(createButton(ctx, { label: 'Back', x: w / 2, y: h - 60 }, onClose));

        return {
            container: root,
            cleanup: () => engine.app.canvas.removeEventListener('wheel', onWheel),
        };
    }
}
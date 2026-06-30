import { Container, type FederatedPointerEvent, Graphics, Text } from 'pixi.js';

import type { IHistoryManager } from '../interfaces/managers';
import type { HistoryEntry } from '../managers/HistoryManager';
import type { MenuPanel, PanelBuildDeps } from '../types';

import { createButton, createPanelTitle, registerFocusableButton } from './UIComponents';

export interface HistoryPanelConfig {
    maxLines?: number;
}

export interface HistoryPanelEntryView {
    speaker: string;
    text: string;
    timestamp: string;
}

export class HistoryPanel implements MenuPanel {
    public id = 'history';
    public label = 'Backlog';
    private config: Required<HistoryPanelConfig>;
    private readonly history: Pick<IHistoryManager, 'getRecent'>;

    constructor(
        history: Pick<IHistoryManager, 'getRecent'>,
        config: HistoryPanelConfig = {},
    ) {
        this.history = history;
        this.config = { maxLines: 50, ...config };
    }

    build(deps: PanelBuildDeps) {
        const { display, focus, onClose, overlayConfig, theme } = deps;
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
        root.addChild(createPanelTitle(cfg, w, 'BACKLOG'));

        const entries = this.history.getRecent(this.config.maxLines).map((entry) => formatHistoryPanelEntry(entry));
        const padding = 40;
        const backMargin = 20;
        const backHeight = cfg.buttonHeight;
        const contentAreaBottom = h - backHeight - backMargin * 2;
        let y = 78;

        const content = new Container();

        const mask = new Graphics().rect(0, 60, w, contentAreaBottom - 60).fill(0xFF_FF_FF);
        root.addChild(mask);
        content.mask = mask;

        if (entries.length === 0) {
            const empty = new Text({
                style: { fill: 0x88_88_88, fontFamily: cfg.fontFamily, fontSize: cfg.fontSize - 4 },
                text: 'No backlog lines yet.'
            });
            empty.position.set(padding, y);
            content.addChild(empty);
        } else {
            for (const entry of entries) {
                const row = new Container();
                const speakerText = new Text({
                    style: {
                        fill: theme.accentColor,
                        fontFamily: cfg.fontFamily,
                        fontSize: cfg.fontSize - 4,
                        fontWeight: 'bold'
                    },
                    text: `${entry.speaker}:`
                });
                speakerText.position.set(12, 10);

                const messageText = new Text({
                    style: {
                        fill: cfg.textColor,
                        fontFamily: cfg.fontFamily,
                        fontSize: cfg.fontSize - 4,
                        wordWrap: true,
                        wordWrapWidth: w - (padding * 2) - 34
                    },
                    text: entry.text
                });
                messageText.position.set(12, 34);

                const timestampText = new Text({
                    style: {
                        fill: 0x88_88_88,
                        fontFamily: cfg.fontFamily,
                        fontSize: Math.max(10, cfg.fontSize - 10),
                    },
                    text: entry.timestamp,
                });
                timestampText.anchor.set(1, 0);
                timestampText.position.set(w - (padding * 2) - 16, 12);

                const rowHeight = Math.max(68, messageText.height + 48);
                const rowBackground = new Graphics()
                    .roundRect(0, 0, w - padding * 2, rowHeight, 6)
                    .fill({ alpha: 0.5, color: cfg.buttonColor })
                    .stroke({ alpha: 0.7, color: theme.borderColor, width: 1 });

                row.addChild(rowBackground, speakerText, messageText, timestampText);
                row.position.set(padding, y);
                content.addChild(row);

                y += rowHeight + 8;
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
        const onWheel = (event: { deltaY: number; }) => {
            applyScroll(-event.deltaY);
        };
        root.on('wheel', onWheel);

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

        return { container: root };
    }
}

export function cleanHistoryPanelText(text: string): string {
    return text
        .replaceAll(/{[^}]+}/g, '')
        .replaceAll(/<[^>]+>/g, '')
        .replaceAll(/\s+/g, ' ')
        .trim();
}

export function formatHistoryPanelEntry(entry: HistoryEntry): HistoryPanelEntryView {
    return {
        speaker: entry.speaker.trim() || 'Narrator',
        text: cleanHistoryPanelText(entry.text) || '...',
        timestamp: formatHistoryPanelTimestamp(entry.timestamp),
    };
}

export function formatHistoryPanelTimestamp(timestamp: number): string {
    if (!Number.isFinite(timestamp)) return '';

    const date = new Date(timestamp);
    if (!Number.isFinite(date.getTime())) return '';

    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

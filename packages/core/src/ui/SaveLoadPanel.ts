import { Container, Graphics, Text } from 'pixi.js';
import type { Engine } from '../Engine';
import type { MenuPanel } from '../types';
import { createPanelTitle, createButton } from './UIComponents';

export interface SaveLoadPanelConfig {
    maxSlots?: number;
}

export class SaveLoadPanel implements MenuPanel {
    public id: string;
    public label: string;
    private readonly mode: 'save' | 'load';
    private config: Required<SaveLoadPanelConfig>;

    constructor(mode: 'save' | 'load', config: SaveLoadPanelConfig = {}) {
        this.mode = mode;
        this.id = mode === 'save' ? 'save' : 'load';
        this.label = mode === 'save' ? 'Save Game' : 'Load Game';
        this.config = { maxSlots: 10, ...config };
    }

    build(engine: Engine, onClose: () => void) {
        const overlay = engine.overlay;
        const ctx = overlay.getUIContext();
        const cfg = ctx.overlayConfig;
        const w = ctx.canvasWidth;
        const h = ctx.canvasHeight;

        const root = overlay.createPanelBase();
        root.addChild(createPanelTitle(ctx, this.mode === 'save' ? 'SAVE GAME' : 'LOAD GAME'));

        const slots = engine.saves.listSlots(this.config.maxSlots);
        const slotHeight = 55;
        const slotSpacing = 8;
        const slotWidth = Math.min(600, w * 0.8);
        const totalHeight = slots.length * (slotHeight + slotSpacing);
        let y = Math.max(70, (h / 2) - (totalHeight / 2));

        slots.forEach((meta, index) => {
            const slotNum = index + 1;
            const slotContainer = new Container();
            slotContainer.eventMode = 'static';
            slotContainer.cursor = 'pointer';

            const slotBg = new Graphics();
            slotBg.roundRect(0, 0, slotWidth, slotHeight, 8);
            slotBg.fill({ color: cfg.buttonColor, alpha: cfg.buttonAlpha });
            slotBg.stroke({ color: ctx.theme.borderColor, width: 1 });

            let label: string;
            if (meta) {
                const date = new Date(meta.savedAt);
                label = `Slot ${slotNum}  —  ${meta.sceneName || 'Unknown'}  (${date.toLocaleString()})`;
            } else {
                label = `Slot ${slotNum}  —  Empty`;
            }

            const slotText = new Text({
                text: label,
                style: { fill: meta ? cfg.textColor : 0x666666, fontSize: cfg.fontSize - 6, fontFamily: cfg.fontFamily }
            });
            slotText.anchor.set(0, 0.5);
            slotText.position.set(15, slotHeight / 2);

            slotContainer.addChild(slotBg, slotText);
            slotContainer.position.set((w - slotWidth) / 2, y);

            slotContainer.on('pointerover', () => {
                slotBg.clear();
                slotBg.roundRect(0, 0, slotWidth, slotHeight, 8);
                slotBg.fill({ color: cfg.buttonHoverColor, alpha: 1 });
                slotBg.stroke({ color: ctx.theme.accentColor, width: 2 });
            });
            slotContainer.on('pointerout', () => {
                slotBg.clear();
                slotBg.roundRect(0, 0, slotWidth, slotHeight, 8);
                slotBg.fill({ color: cfg.buttonColor, alpha: cfg.buttonAlpha });
                slotBg.stroke({ color: ctx.theme.borderColor, width: 1 });
            });
            slotContainer.on('pointerdown', (e: any) => {
                e.stopPropagation();
                if (this.mode === 'save') {
                    engine.saves.save(slotNum);
                    engine.notifications.show(`Saved to Slot ${slotNum}`);
                    engine.overlay.close();
                } else {
                    if (!meta) { engine.notifications.show('Slot is empty'); return; }
                    engine.saves.load(slotNum).then(() => {
                        engine.notifications.show(`Loaded Slot ${slotNum}`);
                        engine.overlay.close();
                    });
                }
            });

            root.addChild(slotContainer);
            y += slotHeight + slotSpacing;
        });

        root.addChild(createButton(ctx, { label: 'Back', x: w / 2, y: h - 60 }, onClose));

        return { container: root };
    }
}
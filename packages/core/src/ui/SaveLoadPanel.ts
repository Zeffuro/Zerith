import { Container, Graphics, Text } from 'pixi.js';
import type { Engine } from '../Engine';
import type { MenuPanel } from '../types';
import { createPanelTitle, createButton, registerFocusableButton } from './UIComponents';

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
        this.config = { maxSlots: 6, ...config };
    }

    build(engine: Engine, onClose: () => void) {
        const overlay = engine.overlay;
        const ctx = overlay.getUIContext();
        const cfg = ctx.overlayConfig;
        const w = ctx.canvasWidth;
        const h = ctx.canvasHeight;
        const focus = overlay.focus;

        const root = overlay.createPanelBase();
        root.addChild(createPanelTitle(ctx, this.mode === 'save' ? 'SAVE GAME' : 'LOAD GAME'));

        const slots = engine.saves.listSlots(this.config.maxSlots);
        const slotHeight = 55;
        const slotSpacing = 8;
        const slotWidth = Math.min(600, w * 0.8);
        const totalHeight = slots.length * (slotHeight + slotSpacing);
        const backButtonHeight = 50;
        const backButtonMargin = 20;
        const availableHeight = h - 70 - backButtonHeight - backButtonMargin * 2;
        let y = Math.max(70, 70 + (availableHeight - totalHeight) / 2);

        const slotBgs: Graphics[] = [];

        const styleSlot = (bg: Graphics, selected: boolean) => {
            bg.clear();
            bg.roundRect(0, 0, slotWidth, slotHeight, 8);
            bg.fill({ color: selected ? cfg.buttonHoverColor : cfg.buttonColor, alpha: selected ? 1 : cfg.buttonAlpha });
            bg.stroke({ color: selected ? ctx.theme.accentColor : ctx.theme.borderColor, width: selected ? 2 : 1 });
        };

        slots.forEach((meta, index) => {
            const slotNum = index + 1;
            const slotContainer = new Container();
            slotContainer.eventMode = 'static';
            slotContainer.cursor = 'pointer';

            const slotBg = new Graphics();
            styleSlot(slotBg, false);
            slotBgs.push(slotBg);

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

            const activateSlot = () => {
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
            };

            slotContainer.on('pointerover', () => styleSlot(slotBg, true));
            slotContainer.on('pointerout', () => styleSlot(slotBg, false));
            slotContainer.on('pointerdown', (e: any) => {
                e.stopPropagation();
                activateSlot();
            });

            focus.register({
                focus: () => styleSlot(slotBg, true),
                blur: () => styleSlot(slotBg, false),
                activate: activateSlot,
            });

            root.addChild(slotContainer);
            y += slotHeight + slotSpacing;
        });

        const backBtn = createButton(ctx, { label: 'Back', x: w / 2, y: h - backButtonHeight - backButtonMargin }, onClose);
        root.addChild(backBtn);

        registerFocusableButton(ctx, focus, backBtn, onClose);

        return { container: root };
    }
}
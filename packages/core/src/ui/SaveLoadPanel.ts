import { Container, type FederatedPointerEvent, Graphics, Text } from 'pixi.js';

import type { Engine } from '../Engine';
import type { MenuPanel } from '../types';

import { createButton, createPanelTitle, registerFocusableButton } from './UIComponents';

export interface SaveLoadPanelConfig {
    maxSlots?: number;
}

export class SaveLoadPanel implements MenuPanel {
    public id: string;
    public label: string;
    private config: Required<SaveLoadPanelConfig>;
    private readonly mode: 'load' | 'save';

    constructor(mode: 'load' | 'save', config: SaveLoadPanelConfig = {}) {
        this.mode = mode;
        this.id = mode === 'save' ? 'save' : 'load';
        this.label = mode === 'save' ? 'Save Game' : 'Load Game';
        this.config = { maxSlots: 6, ...config };
    }

    build(engine: Engine, onClose: () => void) {
        const overlay = engine.overlay;
        const context = overlay.getUIContext();
        const cfg = context.overlayConfig;
        const w = context.canvasWidth;
        const h = context.canvasHeight;
        const focus = overlay.focus;

        const root = overlay.createPanelBase();
        root.addChild(createPanelTitle(context, this.mode === 'save' ? 'SAVE GAME' : 'LOAD GAME'));

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
            bg.fill({ alpha: selected ? 1 : cfg.buttonAlpha, color: selected ? cfg.buttonHoverColor : cfg.buttonColor });
            bg.stroke({ color: selected ? context.theme.accentColor : context.theme.borderColor, width: selected ? 2 : 1 });
        };

        for (const [index, meta] of slots.entries()) {
            const slotNumber = index + 1;
            const slotContainer = new Container();
            slotContainer.eventMode = 'static';
            slotContainer.cursor = 'pointer';

            const slotBg = new Graphics();
            styleSlot(slotBg, false);
            slotBgs.push(slotBg);

            let label: string;
            if (meta) {
                const date = new Date(meta.savedAt);
                label = `Slot ${slotNumber}  —  ${meta.sceneName || 'Unknown'}  (${date.toLocaleString()})`;
            } else {
                label = `Slot ${slotNumber}  —  Empty`;
            }

            const slotText = new Text({
                style: { fill: meta ? cfg.textColor : 0x66_66_66, fontFamily: cfg.fontFamily, fontSize: cfg.fontSize - 6 },
                text: label
            });
            slotText.anchor.set(0, 0.5);
            slotText.position.set(15, slotHeight / 2);

            slotContainer.addChild(slotBg, slotText);
            slotContainer.position.set((w - slotWidth) / 2, y);

            const activateSlot = () => {
                if (this.mode === 'save') {
                    void engine.saves.save(slotNumber);
                    engine.notifications.show(`Saved to Slot ${slotNumber}`);
                    engine.overlay.close();
                } else {
                    if (!meta) { engine.notifications.show('Slot is empty'); return; }
                    void engine.saves.load(slotNumber).then(() => {
                        engine.notifications.show(`Loaded Slot ${slotNumber}`);
                        engine.overlay.close();
                    });
                }
            };

            slotContainer.on('pointerover', () => styleSlot(slotBg, true));
            slotContainer.on('pointerout', () => styleSlot(slotBg, false));
            slotContainer.on('pointerdown', (event: FederatedPointerEvent) => {
                event.stopPropagation();
                activateSlot();
            });

            focus.register({
                activate: activateSlot,
                blur: () => styleSlot(slotBg, false),
                focus: () => styleSlot(slotBg, true),
            });

            root.addChild(slotContainer);
            y += slotHeight + slotSpacing;
        }

        const backButton = createButton(context, { label: 'Back', x: w / 2, y: h - backButtonHeight - backButtonMargin }, onClose);
        root.addChild(backButton);

        registerFocusableButton(context, focus, backButton, onClose);

        return { container: root };
    }
}
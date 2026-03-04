import { Container, Graphics, Text } from 'pixi.js';
import type { Engine } from '../Engine';

export interface PauseMenuConfig {
    backgroundColor?: number;
    backgroundAlpha?: number;
    buttonColor?: number;
    buttonAlpha?: number;
    buttonHoverColor?: number;
    buttonWidth?: number;
    buttonHeight?: number;
    buttonSpacing?: number;
    fontSize?: number;
    fontFamily?: string;
    textColor?: number;
    maxSaveSlots?: number;
    historyLines?: number;
}

export class PauseMenuManager {
    private engine: Engine;
    private config: Required<PauseMenuConfig>;
    private container: Container | null = null;
    private subContainer: Container | null = null;
    private _isOpen = false;

    constructor(engine: Engine, config: PauseMenuConfig = {}) {
        this.engine = engine;
        this.config = {
            backgroundColor: 0x000000,
            backgroundAlpha: 0.85,
            buttonColor: 0x222244,
            buttonAlpha: 0.9,
            buttonHoverColor: 0x333399,
            buttonWidth: 300,
            buttonHeight: 50,
            buttonSpacing: 12,
            fontSize: 22,
            fontFamily: 'Courier New',
            textColor: 0xffffff,
            maxSaveSlots: 10,
            historyLines: 50,
            ...config
        };

        this.engine.on('menu:toggle', () => this.toggle());
    }

    public get isOpen(): boolean {
        return this._isOpen;
    }

    public toggle() {
        if (this._isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    public open() {
        if (this._isOpen) return;
        this._isOpen = true;
        this.showMainMenu();
    }

    public close() {
        if (!this._isOpen) return;
        this._isOpen = false;
        this.clearAll();
    }

    private clearAll() {
        if (this.subContainer) {
            this.subContainer.destroy({ children: true });
            this.subContainer = null;
        }
        if (this.container) {
            this.container.destroy({ children: true });
            this.container = null;
        }
    }

    private showMainMenu() {
        this.clearAll();

        const w = this.engine.display.width;
        const h = this.engine.display.height;

        this.container = new Container();
        this.container.eventMode = 'static';

        // Background overlay
        const bg = new Graphics()
            .rect(0, 0, w, h)
            .fill({ color: this.config.backgroundColor, alpha: this.config.backgroundAlpha });
        bg.eventMode = 'static';
        bg.on('pointerdown', (e: any) => e.stopPropagation());
        this.container.addChild(bg);

        // Title
        const title = new Text({
            text: 'PAUSED',
            style: {
                fill: this.config.textColor,
                fontSize: this.config.fontSize + 10,
                fontFamily: this.config.fontFamily,
                fontWeight: 'bold'
            }
        });
        title.anchor.set(0.5);
        title.position.set(w / 2, h * 0.15);
        this.container.addChild(title);

        // Buttons
        const buttons = [
            { label: 'History', action: () => this.showHistory() },
            { label: 'Save Game', action: () => this.showSaveSlots('save') },
            { label: 'Load Game', action: () => this.showSaveSlots('load') },
            { label: 'Resume', action: () => this.close() },
        ];

        const totalHeight = buttons.length * (this.config.buttonHeight + this.config.buttonSpacing);
        let y = (h / 2) - (totalHeight / 2);

        buttons.forEach(({ label, action }) => {
            const btn = this.createButton(label, w / 2, y, action);
            this.container!.addChild(btn);
            y += this.config.buttonHeight + this.config.buttonSpacing;
        });

        this.engine.layers.overlay.addChild(this.container);
    }

    private showHistory() {
        if (this.subContainer) {
            this.subContainer.destroy({ children: true });
        }

        const w = this.engine.display.width;
        const h = this.engine.display.height;

        this.subContainer = new Container();
        this.subContainer.eventMode = 'static';

        // Background
        const bg = new Graphics()
            .rect(0, 0, w, h)
            .fill({ color: this.config.backgroundColor, alpha: 0.95 });
        bg.eventMode = 'static';
        bg.on('pointerdown', (e: any) => e.stopPropagation());
        this.subContainer.addChild(bg);

        // Title
        const title = new Text({
            text: 'HISTORY',
            style: {
                fill: this.config.textColor,
                fontSize: this.config.fontSize + 6,
                fontFamily: this.config.fontFamily,
                fontWeight: 'bold'
            }
        });
        title.anchor.set(0.5, 0);
        title.position.set(w / 2, 20);
        this.subContainer.addChild(title);

        // History entries
        const entries = this.engine.history.getRecent(this.config.historyLines);
        const padding = 40;
        const lineHeight = 30;
        let y = 70;

        // Scrollable content container
        const content = new Container();

        if (entries.length === 0) {
            const empty = new Text({
                text: 'No dialogue history yet.',
                style: {
                    fill: 0x888888,
                    fontSize: this.config.fontSize - 4,
                    fontFamily: this.config.fontFamily
                }
            });
            empty.position.set(padding, y);
            content.addChild(empty);
        } else {
            entries.forEach((entry) => {
                const speakerText = new Text({
                    text: `${entry.speaker}:`,
                    style: {
                        fill: this.engine.theme.accentColor,
                        fontSize: this.config.fontSize - 4,
                        fontFamily: this.config.fontFamily,
                        fontWeight: 'bold'
                    }
                });
                speakerText.position.set(padding, y);
                content.addChild(speakerText);

                // Strip tags for display
                const cleanText = entry.text
                    .replace(/\{[^}]+\}/g, '')
                    .replace(/<[^>]+>/g, '');

                const msgText = new Text({
                    text: cleanText,
                    style: {
                        fill: this.config.textColor,
                        fontSize: this.config.fontSize - 4,
                        fontFamily: this.config.fontFamily,
                        wordWrap: true,
                        wordWrapWidth: w - (padding * 2) - 10
                    }
                });
                msgText.position.set(padding + 10, y + lineHeight);
                content.addChild(msgText);

                y += lineHeight + msgText.height + 10;
            });
        }

        this.subContainer.addChild(content);

        // Scroll support
        const maxScroll = Math.max(0, y - h + 80);
        let scrollY = -maxScroll; // Start at bottom (most recent)
        content.y = scrollY;

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            scrollY -= e.deltaY;
            scrollY = Math.max(-maxScroll, Math.min(0, scrollY));
            content.y = scrollY;
        };
        this.engine.app.canvas.addEventListener('wheel', onWheel, { passive: false });

        // Back button
        const backBtn = this.createButton('Back', w / 2, h - 60, () => {
            this.engine.app.canvas.removeEventListener('wheel', onWheel);
            this.subContainer?.destroy({ children: true });
            this.subContainer = null;
        });
        this.subContainer.addChild(backBtn);

        this.engine.layers.overlay.addChild(this.subContainer);
    }

    private showSaveSlots(mode: 'save' | 'load') {
        if (this.subContainer) {
            this.subContainer.destroy({ children: true });
        }

        const w = this.engine.display.width;
        const h = this.engine.display.height;

        this.subContainer = new Container();
        this.subContainer.eventMode = 'static';

        // Background
        const bg = new Graphics()
            .rect(0, 0, w, h)
            .fill({ color: this.config.backgroundColor, alpha: 0.95 });
        bg.eventMode = 'static';
        bg.on('pointerdown', (e: any) => e.stopPropagation());
        this.subContainer.addChild(bg);

        // Title
        const title = new Text({
            text: mode === 'save' ? 'SAVE GAME' : 'LOAD GAME',
            style: {
                fill: this.config.textColor,
                fontSize: this.config.fontSize + 6,
                fontFamily: this.config.fontFamily,
                fontWeight: 'bold'
            }
        });
        title.anchor.set(0.5, 0);
        title.position.set(w / 2, 20);
        this.subContainer.addChild(title);

        // Slots
        const slots = this.engine.saves.listSlots(this.config.maxSaveSlots);
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
            slotBg.fill({ color: this.config.buttonColor, alpha: this.config.buttonAlpha });
            slotBg.stroke({ color: this.engine.theme.borderColor, width: 1 });

            let label: string;
            if (meta) {
                const date = new Date(meta.savedAt);
                const timeStr = date.toLocaleString();
                const sceneStr = meta.sceneName || 'Unknown';
                label = `Slot ${slotNum}  —  ${sceneStr}  (${timeStr})`;
            } else {
                label = `Slot ${slotNum}  —  Empty`;
            }

            const slotText = new Text({
                text: label,
                style: {
                    fill: meta ? this.config.textColor : 0x666666,
                    fontSize: this.config.fontSize - 6,
                    fontFamily: this.config.fontFamily
                }
            });
            slotText.anchor.set(0, 0.5);
            slotText.position.set(15, slotHeight / 2);

            slotContainer.addChild(slotBg, slotText);
            slotContainer.position.set((w - slotWidth) / 2, y);

            slotContainer.on('pointerover', () => {
                slotBg.clear();
                slotBg.roundRect(0, 0, slotWidth, slotHeight, 8);
                slotBg.fill({ color: this.config.buttonHoverColor, alpha: 1 });
                slotBg.stroke({ color: this.engine.theme.accentColor, width: 2 });
            });

            slotContainer.on('pointerout', () => {
                slotBg.clear();
                slotBg.roundRect(0, 0, slotWidth, slotHeight, 8);
                slotBg.fill({ color: this.config.buttonColor, alpha: this.config.buttonAlpha });
                slotBg.stroke({ color: this.engine.theme.borderColor, width: 1 });
            });

            slotContainer.on('pointerdown', (e: any) => {
                e.stopPropagation();
                if (mode === 'save') {
                    this.engine.saves.save(slotNum);
                    this.engine.notifications.show(`Saved to Slot ${slotNum}`);
                    this.close();
                } else {
                    if (!meta) {
                        this.engine.notifications.show('Slot is empty');
                        return;
                    }
                    this.engine.saves.load(slotNum);
                    this.engine.notifications.show(`Loaded Slot ${slotNum}`);
                    this.close();
                }
            });

            this.subContainer!.addChild(slotContainer);
            y += slotHeight + slotSpacing;
        });

        // Back button
        const backBtn = this.createButton('Back', w / 2, h - 60, () => {
            this.subContainer?.destroy({ children: true });
            this.subContainer = null;
        });
        this.subContainer.addChild(backBtn);

        this.engine.layers.overlay.addChild(this.subContainer);
    }

    private createButton(label: string, x: number, y: number, action: () => void): Container {
        const btn = new Container();
        btn.eventMode = 'static';
        btn.cursor = 'pointer';

        const bg = new Graphics();
        bg.roundRect(0, 0, this.config.buttonWidth, this.config.buttonHeight, 8);
        bg.fill({ color: this.config.buttonColor, alpha: this.config.buttonAlpha });
        bg.stroke({ color: this.engine.theme.borderColor, width: 2 });

        const txt = new Text({
            text: label,
            style: {
                fill: this.config.textColor,
                fontSize: this.config.fontSize,
                fontFamily: this.config.fontFamily
            }
        });
        txt.anchor.set(0.5);
        txt.position.set(this.config.buttonWidth / 2, this.config.buttonHeight / 2);

        btn.addChild(bg, txt);
        btn.position.set(x - this.config.buttonWidth / 2, y);

        btn.on('pointerover', () => {
            bg.clear();
            bg.roundRect(0, 0, this.config.buttonWidth, this.config.buttonHeight, 8);
            bg.fill({ color: this.config.buttonHoverColor, alpha: 1 });
            bg.stroke({ color: this.engine.theme.accentColor, width: 2 });
        });

        btn.on('pointerout', () => {
            bg.clear();
            bg.roundRect(0, 0, this.config.buttonWidth, this.config.buttonHeight, 8);
            bg.fill({ color: this.config.buttonColor, alpha: this.config.buttonAlpha });
            bg.stroke({ color: this.engine.theme.borderColor, width: 2 });
        });

        btn.on('pointerdown', (e: any) => {
            e.stopPropagation();
            action();
        });

        return btn;
    }
}
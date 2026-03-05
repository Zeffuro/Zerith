import { Container, Graphics, Text } from 'pixi.js';
import type { Engine } from '../Engine';
import type { MenuPanel } from '../types';
import { createButton, type UIContext } from '../ui/UIComponents';
import { PanelFocusManager, type FocusableItem } from '../ui/PanelFocusManager';

export interface OverlayConfig {
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
}

export class OverlayManager {
    private readonly engine: Engine;
    public config: Required<OverlayConfig>;
    private container: Container | null = null;
    private panelContainer: Container | null = null;
    private _isOpen = false;
    private panels: MenuPanel[] = [];
    private _activeCleanup: (() => void) | null = null;
    private _focus: PanelFocusManager | null = null;
    private _onNavigate: ((dir: string) => void) | null = null;
    private _onConfirm: (() => void) | null = null;

    constructor(engine: Engine, config: OverlayConfig = {}) {
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
            ...config
        };

        this.engine.on('menu:toggle', () => this.toggle());
    }

    public getUIContext(): UIContext {
        return {
            theme: this.engine.theme,
            overlayConfig: this.config,
            canvasWidth: this.engine.display.width,
            canvasHeight: this.engine.display.height,
            getCanvasRect: () => this.engine.app.canvas.getBoundingClientRect(),
        };
    }

    public get isOpen(): boolean {
        return this._isOpen;
    }

    public get focus(): PanelFocusManager {
        if (!this._focus) {
            this._focus = new PanelFocusManager();
        }
        return this._focus;
    }

    public setFocus(fm: PanelFocusManager) {
        this._focus = fm;
    }

    public registerPanel(panel: MenuPanel) {
        if (!this.panels.find(p => p.id === panel.id)) {
            this.panels.push(panel);
        }
    }

    public removePanel(id: string) {
        this.panels = this.panels.filter(p => p.id !== id);
    }

    public toggle() {
        this._isOpen ? this.close() : this.open();
    }

    public open() {
        if (this._isOpen) return;
        this._isOpen = true;
        this.subscribeInput();
        this.showMainMenu();
    }

    public close() {
        if (!this._isOpen) return;
        this._isOpen = false;
        this.unsubscribeInput();
        this.clearAll();
    }

    private subscribeInput() {
        this._onNavigate = (dir: string) => {
            this._focus?.navigate(dir as 'up' | 'down' | 'left' | 'right');
        };
        this._onConfirm = () => {
            this._focus?.confirm();
        };
        this.engine.on('input:navigate', this._onNavigate);
        this.engine.on('input:confirm', this._onConfirm);
    }

    private unsubscribeInput() {
        if (this._onNavigate) {
            this.engine.off('input:navigate', this._onNavigate);
            this._onNavigate = null;
        }
        if (this._onConfirm) {
            this.engine.off('input:confirm', this._onConfirm);
            this._onConfirm = null;
        }
        this._focus = null;
    }

    private clearAll() {
        this.closePanel();
        if (this.container) {
            this.container.destroy({ children: true });
            this.container = null;
        }
    }

    public closePanel() {
        if (this._activeCleanup) {
            this._activeCleanup();
            this._activeCleanup = null;
        }
        if (this.panelContainer) {
            this.panelContainer.destroy({ children: true });
            this.panelContainer = null;
        }
    }

    public showPanel(panel: MenuPanel) {
        this.closePanel();
        if (this.container) this.container.visible = false;

        this._focus = new PanelFocusManager();

        const { container, cleanup } = panel.build(this.engine, () => {
            this.closePanel();
            if (this.container) this.container.visible = true;
            this.rebuildMainMenuFocus();
        });

        this.panelContainer = container;
        this._activeCleanup = cleanup ?? null;
        this.engine.layers.overlay.addChild(this.panelContainer);

        this._focus.focusInitial(0);
    }

    private showMainMenu() {
        this.clearAll();

        const ctx = this.getUIContext();
        const w = ctx.canvasWidth;
        const h = ctx.canvasHeight;

        this.container = new Container();
        this.container.eventMode = 'static';

        const bg = new Graphics()
            .rect(0, 0, w, h)
            .fill({ color: this.config.backgroundColor, alpha: this.config.backgroundAlpha });
        bg.eventMode = 'static';
        bg.on('pointerdown', (e: any) => e.stopPropagation());
        this.container.addChild(bg);

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

        const buttons: { label: string; action: () => void }[] = [];
        for (const panel of this.panels) {
            buttons.push({ label: panel.label, action: () => this.showPanel(panel) });
        }
        buttons.push({ label: 'Resume', action: () => this.close() });

        this._focus = new PanelFocusManager();

        const totalHeight = buttons.length * (this.config.buttonHeight + this.config.buttonSpacing);
        let y = (h / 2) - (totalHeight / 2);

        buttons.forEach(({ label, action }) => {
            const btn = createButton(ctx, { label, x: w / 2, y }, action);
            this.container!.addChild(btn);

            // Register as focusable — btn children[0] is the Graphics bg
            const btnBg = btn.children[0] as Graphics;
            const bw = this.config.buttonWidth;
            const bh = this.config.buttonHeight;
            this._focus!.register({
                focus: () => {
                    btnBg.clear();
                    btnBg.roundRect(0, 0, bw, bh, 8);
                    btnBg.fill({ color: this.config.buttonHoverColor, alpha: 1 });
                    btnBg.stroke({ color: ctx.theme.accentColor, width: 2 });
                },
                blur: () => {
                    btnBg.clear();
                    btnBg.roundRect(0, 0, bw, bh, 8);
                    btnBg.fill({ color: this.config.buttonColor, alpha: this.config.buttonAlpha });
                    btnBg.stroke({ color: ctx.theme.borderColor, width: 2 });
                },
                activate: action,
            });

            y += this.config.buttonHeight + this.config.buttonSpacing;
        });

        this._focus.focusInitial(0);
        this.engine.layers.overlay.addChild(this.container);
    }

    private rebuildMainMenuFocus() {
        this.showMainMenu();
    }

    public createPanelBase(): Container {
        const w = this.engine.display.width;
        const h = this.engine.display.height;

        const root = new Container();
        root.eventMode = 'static';

        const bg = new Graphics()
            .rect(0, 0, w, h)
            .fill({ color: this.config.backgroundColor, alpha: 0.95 });
        bg.eventMode = 'static';
        bg.on('pointerdown', (e: any) => e.stopPropagation());
        root.addChild(bg);

        return root;
    }

    public createButton(label: string, x: number, y: number, action: () => void): Container {
        return createButton(this.getUIContext(), { label, x, y }, action);
    }
}
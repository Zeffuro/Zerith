import { Container, FederatedPointerEvent, Graphics, Text } from 'pixi.js';

import type {
    IDisplayManager,
    IEventBus,
} from '../interfaces/managers';
import type { NavigationDirection } from '../interfaces/managers';
import type { MenuPanel } from '../types';
import type { UIVisualContext } from '../ui/UIRenderContext';
import type { Theme } from '../utils/Theme';

import { PanelFocusManager } from '../ui/PanelFocusManager';
import { createButton, registerFocusableButton, type UIContext } from '../ui/UIComponents';

export interface OverlayConfig {
    backgroundAlpha?: number;
    backgroundColor?: number;
    buttonAlpha?: number;
    buttonColor?: number;
    buttonHeight?: number;
    buttonHoverColor?: number;
    buttonSpacing?: number;
    buttonWidth?: number;
    fontFamily?: string;
    fontSize?: number;
    textColor?: number;
    uiScale?: number;
}

export interface OverlayManagerDeps {
    display: Pick<IDisplayManager, 'height' | 'width'>;
    events: Pick<IEventBus, 'off' | 'on'>;
    getCanvasElement: () => HTMLCanvasElement | undefined;
    getTheme: () => Theme;
    overlayLayer: Container;
}

export class OverlayManager {
    public config: Required<OverlayConfig>;
    public get focus(): PanelFocusManager {
        if (!this._focus) {
            this._focus = new PanelFocusManager();
        }
        return this._focus;
    }
    public get isOpen(): boolean {
        return this._isOpen;
    }
    private _activeCleanup: (() => void) | undefined;
    private _focus: PanelFocusManager | undefined;
    private _isOpen = false;
    private _onBack: (() => void) | undefined;
    private _onConfirm: (() => void) | undefined;
    private _onNavigate: ((direction: NavigationDirection) => void) | undefined;
    private container: Container | undefined;
    private readonly deps: OverlayManagerDeps;
    private panelContainer: Container | undefined;

    private panels: MenuPanel[] = [];

    private sceneLoadingText: Text | undefined;

    constructor(deps: OverlayManagerDeps, config: OverlayConfig = {}) {
        this.deps = deps;
        this.config = {
            backgroundAlpha: 0.85,
            backgroundColor: 0x00_00_00,
            buttonAlpha: 0.9,
            buttonColor: 0x22_22_44,
            buttonHeight: 50,
            buttonHoverColor: 0x33_33_99,
            buttonSpacing: 12,
            buttonWidth: 300,
            fontFamily: 'Courier New',
            fontSize: 22,
            textColor: 0xFF_FF_FF,
            uiScale: 1,
            ...config
        };

        const events = this.deps.events;
        events.on('menu:toggle', () => this.toggle());
        events.on('scene:loading', (sceneName: string) => this.showSceneLoading(sceneName));
        events.on('scene:loaded', () => this.hideSceneLoading());
    }

    public close() {
        if (!this._isOpen) return;
        this._isOpen = false;
        this.unsubscribeInput();
        this.clearAll();
    }

    public closePanel() {
        if (this._activeCleanup) {
            this._activeCleanup();
            this._activeCleanup = undefined;
        }
        if (this.panelContainer) {
            this.panelContainer.destroy({ children: true });
            this.panelContainer = undefined;
        }
    }

    /*
    public createButton(label: string, x: number, y: number, action: () => void): Container {
        return createButton(this.getUIContext(), { label, x, y }, action);
    }
    */

    public createPanelBase(): Container {
        const display = this.deps.display;
        const w = display.width;
        const h = display.height;

        const root = new Container();
        root.eventMode = 'static';

        const bg = new Graphics()
            .rect(0, 0, w, h)
            .fill({ alpha: 0.95, color: this.config.backgroundColor });
        bg.eventMode = 'static';
        bg.on('pointerdown', (event: FederatedPointerEvent) => event.stopPropagation());
        root.addChild(bg);

        return root;
    }

    public getUIContext(): UIContext {
        const display = this.deps.display;
        return {
            canvasHeight: display.height,
            canvasWidth: display.width,
            getCanvasRect: () => this.getCanvasElement()?.getBoundingClientRect() ?? new DOMRect(0, 0, display.width, display.height),
            overlayConfig: this.config,
            theme: this.deps.getTheme(),
        };
    }

    public open() {
        if (this._isOpen) return;
        this._isOpen = true;
        this.subscribeInput();
        this.showMainMenu();
    }

    public registerPanel(panel: MenuPanel) {
        if (!this.panels.some(p => p.id === panel.id)) {
            this.panels.push(panel);
        }
    }

    /*
    public removePanel(id: string) {
        this.panels = this.panels.filter(p => p.id !== id);
    }
    */

    public scale(value: number): number {
        return Math.round(value * this.config.uiScale);
    }

    /*
    public setFocus(fm: PanelFocusManager) {
        this._focus = fm;
    }
    */

    public showPanel(panel: MenuPanel) {
        if (this.panelContainer) this.closePanel();

        if (this.container) this.container.visible = false;
        
        this._focus = new PanelFocusManager();
        this._focus.onBack = () => {
            this.closePanel();
            if (this.container) this.container.visible = true;
            this.rebuildMainMenuFocus();
        };

        const { cleanup, container } = panel.build(this.createVisualContext(), this._focus.onBack);

        this.panelContainer = container;
        this._activeCleanup = cleanup;
        this.deps.overlayLayer.addChild(this.panelContainer);

        this._focus.focusInitial(0);
    }

    public toggle() {
        if (this._isOpen) this.close();
        else this.open();
    }

    private clearAll() {
        this.closePanel();
        if (this.container) {
            this.container.destroy({ children: true });
            this.container = undefined;
        }
        this.hideSceneLoading();
    }

    private createVisualContext(): UIVisualContext {
        const { display } = this.deps;
        return {
            canvasElement: this.requireCanvasElement(),
            canvasHeight: display.height,
            canvasWidth: display.width,
            createPanelBase: () => this.createPanelBase(),
            focus: this.focus,
            overlayConfig: this.config,
            theme: this.deps.getTheme(),
        };
    }

    private getCanvasElement(): HTMLCanvasElement | undefined {
        return this.deps.getCanvasElement();
    }

    private hideSceneLoading() {
        if (!this.sceneLoadingText) return;
        this.sceneLoadingText.destroy();
        this.sceneLoadingText = undefined;
    }

    private rebuildMainMenuFocus() {
        this.showMainMenu();
    }

    private requireCanvasElement(): HTMLCanvasElement {
        const canvas = this.getCanvasElement();
        if (!canvas) {
            throw new Error('Overlay canvas is not initialized yet.');
        }
        return canvas;
    }

    private showMainMenu() {
        this.clearAll();

        const context = this.getUIContext();
        const w = context.canvasWidth;
        const h = context.canvasHeight;

        this.container = new Container();
        this.container.eventMode = 'static';

        const bg = new Graphics()
            .rect(0, 0, w, h)
            .fill({ alpha: this.config.backgroundAlpha, color: this.config.backgroundColor });
        bg.eventMode = 'static';
        bg.on('pointerdown', (event: FederatedPointerEvent) => event.stopPropagation());
        this.container.addChild(bg);

        const title = new Text({
            style: {
                fill: this.config.textColor,
                fontFamily: this.config.fontFamily,
                fontSize: this.config.fontSize + 10,
                fontWeight: 'bold'
            },
            text: 'PAUSED'
        });
        title.anchor.set(0.5);
        title.position.set(w / 2, h * 0.15);
        this.container.addChild(title);

        const buttons: { action: () => void; label: string; }[] = [];
        for (const panel of this.panels) {
            buttons.push({ action: () => this.showPanel(panel), label: panel.label });
        }
        buttons.push({ action: () => this.close(), label: 'Resume' });

        this._focus = new PanelFocusManager();
        this._focus.onBack = () => this.close();

        const totalHeight = buttons.length * (this.config.buttonHeight + this.config.buttonSpacing);
        let y = (h / 2) - (totalHeight / 2);

        for (const { action, label } of buttons) {
            const button = createButton(context, { label, x: w / 2, y }, action);
            this.container.addChild(button);
            registerFocusableButton(context, this._focus, button, action);
            y += this.config.buttonHeight + this.config.buttonSpacing;
        }

        this._focus.focusInitial(0);
        this.deps.overlayLayer.addChild(this.container);
    }

    private showSceneLoading(sceneName: string) {
        this.hideSceneLoading();

        const label = sceneName ? `Loading ${sceneName}...` : 'Loading...';
        const loadingText = new Text({
            style: {
                fill: this.config.textColor,
                fontFamily: this.config.fontFamily,
                fontSize: this.scale(16)
            },
            text: label
        });
        loadingText.anchor.set(1, 1);
        const display = this.deps.display;
        loadingText.position.set(display.width - this.scale(20), display.height - this.scale(20));
        this.sceneLoadingText = loadingText;
        this.deps.overlayLayer.addChild(loadingText);
    }

    private subscribeInput() {
        this._onNavigate = (direction: NavigationDirection) => {
            this._focus?.navigate(direction);
        };
        this._onConfirm = () => {
            this._focus?.confirm();
        };
        this._onBack = () => {
            this._focus?.back();
        };
        const events = this.deps.events;
        events.on('input:navigate', this._onNavigate);
        events.on('input:confirm', this._onConfirm);
        events.on('input:back', this._onBack);
    }

    private unsubscribeInput() {
        const events = this.deps.events;
        if (this._onNavigate) {
            events.off('input:navigate', this._onNavigate);
            this._onNavigate = undefined;
        }
        if (this._onConfirm) {
            events.off('input:confirm', this._onConfirm);
            this._onConfirm = undefined;
        }
        if (this._onBack) {
            events.off('input:back', this._onBack);
            this._onBack = undefined;
        }
        this._focus = undefined;
    }
}
import gsap from 'gsap';
import { Container, Graphics, HTMLText, Sprite, Text, type TextStyleOptions } from 'pixi.js';

import type { Engine } from '../../Engine';

export interface DialogueRendererConfig {
    backgroundAlpha?: number;
    backgroundColor?: number;
    borderColor?: number;
    borderWidth?: number;
    boxHeight?: number;
    boxWidth?: number;
    boxX?: number;
    boxY?: number;
    messageStyle?: Partial<TextStyleOptions>;
    nameStyle?: Partial<TextStyleOptions>;
}

export class DialogueRenderer {
    private readonly config: DialogueRendererConfig;
    private container: Container | null = null;
    private messageText!: HTMLText;
    private nameText!: Text;
    private portraitSprite!: Sprite;

    constructor(config: DialogueRendererConfig) {
        this.config = config;
    }

    public clearMessage() {
        this.messageText.text = '';
    }

    public createPromptBlinker(): Graphics {
        const blinker = new Graphics().poly([0, 0, 15, 0, 7.5, 10]).fill(0xFF_FF_FF);
        blinker.position.set(
            this.messageText.x + this.messageText.width,
            this.messageText.y + this.messageText.height
        );
        this.container?.addChild(blinker);
        gsap.to(blinker, { alpha: 0, duration: 0.5, repeat: -1, yoyo: true });
        return blinker;
    }

    public ensureUI(engine: Engine) {
        if (this.container) return;

        const t = engine.theme;
        const w = engine.display.width;
        const h = engine.display.height;

        const margin = 20;
        const boxWidth = this.config.boxWidth ?? (w - margin * 2);
        const boxHeight = this.config.boxHeight ?? (h * 0.3);
        const boxX = this.config.boxX ?? margin;
        const boxY = this.config.boxY ?? (h - boxHeight - margin);
        const padding = 20;

        this.container = new Container();
        this.portraitSprite = new Sprite();
        engine.layers.sprites.addChild(this.portraitSprite);

        const bg = new Graphics()
            .roundRect(boxX, boxY, boxWidth, boxHeight, 10)
            .fill({
                alpha: this.config.backgroundAlpha ?? t.boxAlpha,
                color: this.config.backgroundColor ?? t.boxColor
            })
            .stroke({
                color: this.config.borderColor ?? t.borderColor,
                width: this.config.borderWidth ?? t.borderWidth
            });

        this.nameText = new Text({
            style: {
                fontFamily: t.fontFamily,
                fontSize: t.fontSize + 4,
                fontWeight: 'bold',
                ...this.config.nameStyle,
            },
            text: ''
        });
        this.nameText.position.set(boxX + padding, boxY + 15);

        this.messageText = new HTMLText({
            style: {
                fill: '#ffffff',
                fontFamily: t.fontFamily,
                fontSize: t.fontSize,
                wordWrap: true,
                wordWrapWidth: boxWidth - (padding * 2),
                ...this.config.messageStyle,
            },
            text: ''
        });
        this.messageText.position.set(boxX + padding, boxY + 55);

        this.container.addChild(bg, this.nameText, this.messageText);
        engine.layers.ui.addChild(this.container);
    }

    public getMessageText(): string {
        return this.messageText.text;
    }

    public hidePortrait() {
        this.portraitSprite.visible = false;
    }

    public reset() {
        this.container = null;
    }

    public setMessageText(text: string) {
        this.messageText.text = text;
    }

    public setSpeaker(displayName: string, fill: number | string) {
        this.nameText.text = displayName;
        this.nameText.style.fill = fill as any;
    }

    public async showPortrait(engine: Engine, portraitUrl: string, side: 'left' | 'right') {
        this.portraitSprite.texture = await engine.loadAsset(portraitUrl);
        this.portraitSprite.visible = true;
        this.portraitSprite.anchor.set(0.5, 1);

        const w = engine.display.width;
        const boxY = this.config.boxY ?? (engine.display.height * 2 / 3);
        this.portraitSprite.position.set(
            side === 'right' ? w * 0.8 : w * 0.2,
            boxY
        );

        const scale = (boxY * 0.9) / this.portraitSprite.texture.height;
        this.portraitSprite.scale.set(side === 'right' ? -scale : scale, scale);
    }
}


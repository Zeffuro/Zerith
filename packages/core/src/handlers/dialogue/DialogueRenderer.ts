import { Container, Graphics, HTMLText, Sprite, Text, type TextStyleOptions } from 'pixi.js';
import gsap from 'gsap';
import type { Engine } from '../../Engine';

export interface DialogueRendererConfig {
    boxX?: number;
    boxY?: number;
    boxWidth?: number;
    boxHeight?: number;
    backgroundColor?: number;
    backgroundAlpha?: number;
    borderColor?: number;
    borderWidth?: number;
    nameStyle?: Partial<TextStyleOptions>;
    messageStyle?: Partial<TextStyleOptions>;
}

export class DialogueRenderer {
    private readonly config: DialogueRendererConfig;
    private container: Container | null = null;
    private nameText!: Text;
    private messageText!: HTMLText;
    private portraitSprite!: Sprite;

    constructor(config: DialogueRendererConfig) {
        this.config = config;
    }

    public reset() {
        this.container = null;
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
                color: this.config.backgroundColor ?? t.boxColor,
                alpha: this.config.backgroundAlpha ?? t.boxAlpha
            })
            .stroke({
                color: this.config.borderColor ?? t.borderColor,
                width: this.config.borderWidth ?? t.borderWidth
            });

        this.nameText = new Text({
            text: '',
            style: {
                fontFamily: t.fontFamily,
                fontSize: t.fontSize + 4,
                fontWeight: 'bold',
                ...this.config.nameStyle,
            }
        });
        this.nameText.position.set(boxX + padding, boxY + 15);

        this.messageText = new HTMLText({
            text: '',
            style: {
                fontFamily: t.fontFamily,
                fontSize: t.fontSize,
                fill: '#ffffff',
                wordWrap: true,
                wordWrapWidth: boxWidth - (padding * 2),
                ...this.config.messageStyle,
            }
        });
        this.messageText.position.set(boxX + padding, boxY + 55);

        this.container.addChild(bg, this.nameText, this.messageText);
        engine.layers.ui.addChild(this.container);
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

    public hidePortrait() {
        this.portraitSprite.visible = false;
    }

    public clearMessage() {
        this.messageText.text = '';
    }

    public setMessageText(text: string) {
        this.messageText.text = text;
    }

    public getMessageText(): string {
        return this.messageText.text;
    }

    public createPromptBlinker(): Graphics {
        const blinker = new Graphics().poly([0, 0, 15, 0, 7.5, 10]).fill(0xffffff);
        blinker.position.set(
            this.messageText.x + this.messageText.width,
            this.messageText.y + this.messageText.height
        );
        this.container?.addChild(blinker);
        gsap.to(blinker, { alpha: 0, duration: 0.5, repeat: -1, yoyo: true });
        return blinker;
    }
}


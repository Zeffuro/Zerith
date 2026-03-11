import { Container, Graphics, HTMLText, Sprite, Text, type TextStyleOptions, type Texture } from 'pixi.js';

import type { IAnimationManager, IAssetManager, IDisplayManager } from '../../interfaces/managers';

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
    private readonly animations: IAnimationManager;
    private readonly assets: IAssetManager;
    private readonly config: DialogueRendererConfig;
    private container: Container | undefined;
    private readonly display: IDisplayManager;
    private messageText!: HTMLText;
    private nameText!: Text;
    private portraitSprite!: Sprite;

    constructor(
        config: DialogueRendererConfig,
        animations: IAnimationManager,
        display: IDisplayManager,
        assets: IAssetManager,
    ) {
        this.config = config;
        this.animations = animations;
        this.display = display;
        this.assets = assets;
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
        void this.animations.to(blinker, { alpha: 0, duration: 0.5, repeat: -1, yoyo: true });
        return blinker;
    }

    public destroy(): void {
        this.container?.removeFromParent();
        this.container?.destroy({ children: true });
        this.container = undefined;

        this.portraitSprite?.removeFromParent();
        this.portraitSprite?.destroy();
    }

    public ensureUI() {
        if (this.container) return;

        const w = this.display.width;
        const h = this.display.height;

        const margin = 20;
        const boxWidth = this.config.boxWidth ?? (w - margin * 2);
        const boxHeight = this.config.boxHeight ?? (h * 0.3);
        const boxX = this.config.boxX ?? margin;
        const boxY = this.config.boxY ?? (h - boxHeight - margin);
        const padding = 20;

        this.container = new Container();
        this.portraitSprite = new Sprite();
        this.display.getLayer('sprites').addChild(this.portraitSprite);

        const bg = new Graphics()
            .roundRect(boxX, boxY, boxWidth, boxHeight, 10)
            .fill({
                alpha: this.config.backgroundAlpha ?? 0.85,
                color: this.config.backgroundColor ?? 0x00_00_00
            })
            .stroke({
                color: this.config.borderColor ?? 0xFF_FF_FF,
                width: this.config.borderWidth ?? 2
            });

        this.nameText = new Text({
            style: {
                ...this.config.nameStyle,
                fontFamily: 'Arial',
                fontSize: 32,
                fontWeight: 'bold',
            },
            text: ''
        });
        const nameX = boxX + padding;
        const nameY = boxY + 15;
        this.nameText.position.set(nameX, nameY);

        this.messageText = new HTMLText({
            style: {
                align: 'left',
                fill: '#ffffff',
                fontFamily: 'Arial',
                fontSize: 28,
                wordWrap: true,
                wordWrapWidth: boxWidth - (padding * 2),
            },
            text: ''
        });
        const messageX = boxX + padding;
        const messageY = boxY + 55;
        this.messageText.position.set(messageX, messageY);

        this.container.addChild(bg, this.nameText, this.messageText);
        this.display.getLayer('ui').addChild(this.container);
    }


    public getMessageText(): string {
        return this.messageText.text;
    }

    public hidePortrait() {
        this.portraitSprite.visible = false;
    }

    public reset() {
        this.destroy();
        this.container = undefined;
    }

    public setMessageText(text: string) {
        this.messageText.text = text;
    }

    public setSpeaker(displayName: string, fill: number | string) {
        this.nameText.text = displayName;
        this.nameText.style.fill = fill;
    }

    public async showPortrait(portraitUrl: string, side: 'left' | 'right') {
        this.portraitSprite.texture = await this.assets.load<Texture>(portraitUrl);
        this.portraitSprite.visible = true;
        this.portraitSprite.anchor.set(0.5, 1);

        const w = this.display.width;
        const boxY = this.config.boxY ?? (this.display.height * 2 / 3);
        this.portraitSprite.position.set(
            side === 'right' ? w * 0.8 : w * 0.2,
            boxY
        );

        const scale = (boxY * 0.9) / this.portraitSprite.texture.height;
        this.portraitSprite.scale.set(side === 'right' ? -scale : scale, scale);
    }
}

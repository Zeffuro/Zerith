import { Container, Graphics, HTMLText, Sprite, Text, type TextStyleOptions, type Texture } from 'pixi.js';

import type { IAnimationManager, IAssetManager, IDisplayManager } from '../../interfaces/managers';

import { calculateDialogueLayout } from './DialogueLayout';

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
    private messageMask!: Graphics;
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

        const layout = calculateDialogueLayout({
            config: this.config,
            displayHeight: this.display.height,
            displayWidth: this.display.width,
        });

        this.container = new Container();
        this.portraitSprite = new Sprite();
        this.display.getLayer('sprites').addChild(this.portraitSprite);

        const bg = new Graphics()
            .roundRect(layout.boxX, layout.boxY, layout.boxWidth, layout.boxHeight, 10)
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
                fontFamily: 'Arial',
                fontWeight: 'bold',
                ...this.config.nameStyle,
                fontSize: layout.nameFontSize,
            },
            text: ''
        });
        this.nameText.position.set(layout.nameX, layout.nameY);

        this.messageText = new HTMLText({
            style: {
                align: 'left',
                breakWords: true,
                fill: '#ffffff',
                fontFamily: 'Arial',
                wordWrap: true,
                ...this.config.messageStyle,
                fontSize: layout.messageFontSize,
                wordWrapWidth: layout.messageWidth,
            },
            text: ''
        });
        this.messageText.position.set(layout.messageX, layout.messageY);

        this.messageMask = new Graphics()
            .rect(layout.messageX, layout.messageY, layout.messageWidth, layout.messageHeight)
            .fill(0xFF_FF_FF);
        this.messageMask.renderable = false;
        this.messageText.mask = this.messageMask;

        this.container.addChild(bg, this.nameText, this.messageText, this.messageMask);
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

        const layout = calculateDialogueLayout({
            config: this.config,
            displayHeight: this.display.height,
            displayWidth: this.display.width,
        });
        this.portraitSprite.position.set(
            side === 'right' ? layout.portraitRightX : layout.portraitLeftX,
            layout.portraitBaselineY
        );

        const scale = Math.min(
            layout.portraitMaxHeight / this.portraitSprite.texture.height,
            layout.portraitMaxWidth / this.portraitSprite.texture.width,
        );
        this.portraitSprite.scale.set(side === 'right' ? -scale : scale, scale);
    }

    public async syncPortrait(portraitUrl: string | undefined, side: 'left' | 'right'): Promise<void> {
        if (!portraitUrl) {
            this.hidePortrait();
            return;
        }

        await this.showPortrait(portraitUrl, side);
    }
}

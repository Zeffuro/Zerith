import { Assets, Container, Graphics, Sprite, Text, type TextStyleOptions } from 'pixi.js';
import { sound } from '@pixi/sound';
import type { BaseCommand, CommandHandler } from '../types';
import type { Engine } from '../Engine';
import { parseTextTags } from '../utils/TextParser';

export interface DialogueCommand extends BaseCommand {
    type: 'dialogue';
    speaker: string;
    text: string;
    portraitSide?: 'left' | 'right';
}

export interface CharacterConfig {
    displayName: string;
    nameColor?: string;
    portraitUrl?: string;
    blipUrl?: string;
}

export interface DialogueConfig {
    boxX?: number; boxY?: number; boxWidth?: number; boxHeight?: number;
    backgroundColor?: number; backgroundAlpha?: number;
    borderColor?: number; borderWidth?: number;
    typewriterSpeed?: number; defaultBlipUrl?: string;
    nameStyle?: Partial<TextStyleOptions>; messageStyle?: Partial<TextStyleOptions>;
    characters?: Record<string, CharacterConfig>;
}

export class DialogueHandler implements CommandHandler<DialogueCommand> {
    public type = 'dialogue';
    public autoNext = false;
    private config: DialogueConfig;
    private container: Container | null = null;
    private nameText!: Text;
    private messageText!: Text;
    private portraitSprite!: Sprite;

    constructor(userConfig: DialogueConfig = {}) {
        this.config = {
            boxX: 20, boxY: 400, boxWidth: 760, boxHeight: 180,
            backgroundColor: 0x000000, backgroundAlpha: 0.7,
            borderColor: 0xffffff, borderWidth: 3, typewriterSpeed: 30,
            characters: {}, ...userConfig
        };
    }

    execute = async (command: DialogueCommand, engine: Engine) => {
        if (!this.container) this.buildUI(engine);

        const charData = this.config.characters?.[command.speaker];
        this.nameText.text = charData?.displayName || command.speaker;
        this.nameText.style.fill = charData?.nameColor || this.config.nameStyle?.fill || '#aaffaa';

        if (charData?.portraitUrl) {
            this.portraitSprite.texture = await Assets.load(charData.portraitUrl);
            this.portraitSprite.visible = true;
            const availableHeight = this.config.boxY! - 20;
            this.portraitSprite.scale.set(availableHeight / this.portraitSprite.texture.height);
            this.portraitSprite.anchor.set(0.5, 1);
            if ((command.portraitSide || 'left') === 'left') {
                this.portraitSprite.position.set(150, this.config.boxY!);
                this.portraitSprite.scale.x = Math.abs(this.portraitSprite.scale.x);
            } else {
                this.portraitSprite.position.set(engine.app.screen.width - 150, this.config.boxY!);
                this.portraitSprite.scale.x = -Math.abs(this.portraitSprite.scale.x);
            }
        } else {
            this.portraitSprite.visible = false;
        }

        const rawBlipUrl = charData?.blipUrl || this.config.defaultBlipUrl;
        let validBlipUrl: string | null = null;
        if (rawBlipUrl) {
            try {
                if (!sound.exists(rawBlipUrl)) sound.add(rawBlipUrl, {url: rawBlipUrl, preload: true});
                validBlipUrl = rawBlipUrl;
            } catch (e) {}
        }

        this.container!.visible = true;
        this.messageText.text = "";

        const tokens = parseTextTags(command.text);
        let currentSpeed = this.config.typewriterSpeed!;

        for (const token of tokens) {
            if (token.type === 'wait') {
                await new Promise(r => setTimeout(r, token.ms));
            } else if (token.type === 'speed') {
                currentSpeed = token.speed;
            } else if (token.type === 'char') {
                this.messageText.text += token.val;
                if (validBlipUrl && token.val !== ' ') {
                    sound.play(validBlipUrl, { volume: 0.2 * engine.audio.voiceVolume });
                }
                if (currentSpeed > 0) {
                    await new Promise(r => setTimeout(r, currentSpeed));
                }
            }
        }
    };

    private buildUI(engine: Engine) {
        this.container = new Container();
        this.portraitSprite = new Sprite();
        this.portraitSprite.visible = false;
        engine.layers.sprites.addChild(this.portraitSprite);

        const bgBox = new Graphics();
        bgBox.roundRect(this.config.boxX!, this.config.boxY!, this.config.boxWidth!, this.config.boxHeight!, 10);
        bgBox.fill({ color: this.config.backgroundColor, alpha: this.config.backgroundAlpha });
        if (this.config.borderWidth! > 0) bgBox.stroke({ color: this.config.borderColor, width: this.config.borderWidth });

        this.nameText = new Text({ text: '', style: { fontFamily: 'Arial', fontSize: 24, fontWeight: 'bold', fill: '#aaffaa', ...this.config.nameStyle } });
        this.nameText.position.set(this.config.boxX! + 20, this.config.boxY! + 20);

        this.messageText = new Text({ text: '', style: { fontFamily: 'Arial', fontSize: 28, fill: '#ffffff', wordWrap: true, wordWrapWidth: this.config.boxWidth! - 40, ...this.config.messageStyle } });
        this.messageText.position.set(this.config.boxX! + 20, this.config.boxY! + 70);

        this.container.addChild(bgBox, this.nameText, this.messageText);
        engine.layers.ui.addChild(this.container);
    }
}
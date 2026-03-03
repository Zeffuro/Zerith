import { Assets, Container, Graphics, Sprite, Text, HTMLText, type TextStyleOptions } from 'pixi.js';
import { sound } from '@pixi/sound';
import type { CommandHandler } from '../types';
import type { Engine } from '../Engine';
import { parseTextTags, transformShorthands } from '../utils/TextParser';

export interface CharacterConfig {
    displayName: string;
    nameColor?: string;
    portraitUrl?: string;
    blipUrl?: string;
}

export interface DialogueCommand {
    type: 'dialogue';
    speaker: string;
    text: string;
    portraitSide?: 'left' | 'right';
}

export interface DialogueConfig {
    boxX?: number;
    boxY?: number;
    boxWidth?: number;
    boxHeight?: number;
    backgroundColor?: number;
    backgroundAlpha?: number;
    borderColor?: number;
    borderWidth?: number;
    typewriterSpeed?: number;
    defaultBlipUrl?: string;
    nameStyle?: Partial<TextStyleOptions>;
    messageStyle?: Partial<TextStyleOptions>;
    characters?: Record<string, CharacterConfig>;
}

export class DialogueHandler implements CommandHandler<DialogueCommand> {
    public type = 'dialogue';
    public autoNext = false;
    private config: DialogueConfig;
    private container: Container | null = null;
    private nameText!: Text;
    private messageText!: HTMLText;
    private portraitSprite!: Sprite;
    private currentSession = 0;

    constructor(config: DialogueConfig) {
        this.config = { typewriterSpeed: 30, characters: {}, ...config };
    }

    reset = () => { this.currentSession++; this.container = null; };

    execute = async (command: DialogueCommand, engine: Engine) => {
        const session = ++this.currentSession;
        if (!this.container) this.buildUI(engine);

        const speakerKey = command.speaker.toLowerCase();
        const charData = this.config.characters?.[speakerKey] ||
            Object.entries(this.config.characters || {})
                .find(([k]) => k.toLowerCase() === speakerKey)?.[1];

        this.nameText.text = charData?.displayName || command.speaker;
        this.nameText.style.fill = charData?.nameColor || engine.theme.accentColor;

        if (charData?.portraitUrl) {
            this.portraitSprite.texture = await Assets.load(charData.portraitUrl);
            this.portraitSprite.visible = true;
            this.portraitSprite.anchor.set(0.5, 1);

            const w = engine.display.width;
            const boxY = this.config.boxY ?? (engine.display.height * 2 / 3);
            this.portraitSprite.position.set(
                command.portraitSide === 'right' ? w * 0.8 : w * 0.2,
                boxY
            );
            const scale = (boxY * 0.9) / this.portraitSprite.texture.height;
            this.portraitSprite.scale.set(
                command.portraitSide === 'right' ? -scale : scale,
                scale
            );
        } else {
            this.portraitSprite.visible = false;
        }

        const blipUrl = charData?.blipUrl || this.config.defaultBlipUrl;
        if (blipUrl) {
            try {
                if (!sound.exists(blipUrl)) {
                    await new Promise((res, rej) => {
                        sound.add(blipUrl, {
                            url: blipUrl,
                            preload: true,
                            loaded: (err) => err ? rej(err) : res(null)
                        });
                    });
                }
            } catch (e) {
                engine.logger.warn(`Blip failed to load: ${blipUrl}`);
            }
        }

        this.messageText.text = "";
        const transformed = transformShorthands(command.text);
        const tokens = parseTextTags(transformed);
        let currentSpeed = this.config.typewriterSpeed!;

        for (const token of tokens) {
            if (session !== this.currentSession) return;
            if (token.type === 'wait') await new Promise(r => setTimeout(r, token.ms));
            else if (token.type === 'speed') currentSpeed = token.speed;
            else if (token.type === 'text') {
                await this.typewrite(token.val, currentSpeed, blipUrl, engine, session);
            }
        }
    };

    private async typewrite(t: string, speed: number, blip: string | undefined, engine: Engine, session: number) {
        let current = this.messageText.text;
        let i = 0;
        while (i < t.length) {
            if (session !== this.currentSession) return;

            if (t[i] === '<') {
                const end = t.indexOf('>', i);
                current += t.slice(i, end + 1);
                i = end + 1;
            } else {
                current += t[i];

                if (blip && t[i] !== ' ' && t[i] !== '\n' && sound.exists(blip)) {
                    sound.play(blip, { volume: 0.1 * engine.audio.voiceVolume });
                }
                i++;
            }

            this.messageText.text = current;
            if (speed > 0) await new Promise(r => setTimeout(r, speed));
        }
    }

    private buildUI(engine: Engine) {
        const t = engine.theme;
        const w = engine.display.width;
        const h = engine.display.height;

        const margin = 20;
        const boxWidth = w - (margin * 2);
        const boxHeight = h * 0.3;
        const boxX = margin;
        const boxY = h - boxHeight - margin;
        const padding = 20;

        this.container = new Container();
        this.portraitSprite = new Sprite();
        engine.layers.sprites.addChild(this.portraitSprite);

        const bg = new Graphics()
            .roundRect(boxX, boxY, boxWidth, boxHeight, 10)
            .fill({ color: t.boxColor, alpha: t.boxAlpha })
            .stroke({ color: t.borderColor, width: t.borderWidth });

        this.nameText = new Text({
            text: '',
            style: {
                fontFamily: t.fontFamily,
                fontSize: t.fontSize + 4,
                fontWeight: 'bold'
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
                wordWrapWidth: boxWidth - (padding * 2)
            }
        });
        this.messageText.position.set(boxX + padding, boxY + 55);

        this.container.addChild(bg, this.nameText, this.messageText);
        engine.layers.ui.addChild(this.container);
    }
}
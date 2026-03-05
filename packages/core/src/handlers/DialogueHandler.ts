import {Assets, Container, Graphics, HTMLText, Sprite, Text, type TextStyleOptions} from 'pixi.js';
import {sound} from '@pixi/sound';
import type {CommandHandler} from '../types';
import type {CharacterDefinition} from '../types';
import type {Engine} from '../Engine';
import {parseTextTags, transformShorthands} from '../utils/TextParser';

export interface DialogueCommand {
    type: 'dialogue';
    speaker: string;
    text: string;
    portraitSide?: 'left' | 'right';
    instant?: boolean;
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
    characters?: Record<string, CharacterDefinition>;
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
        engine.consumeSkip();
        if (!this.container) this.buildUI(engine);

        const speakerKey = command.speaker.toLowerCase();
        const charData = this.config.characters?.[speakerKey] ||
            Object.entries(this.config.characters || {})
                .find(([k]) => k.toLowerCase() === speakerKey)?.[1];

        const displayName = charData?.displayName || command.speaker;

        engine.history.push(displayName, command.text);

        this.nameText.text = displayName;
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

            engine.setState('__sys_dialogue', {
                speaker: command.speaker,
                text: command.text,
                portraitUrl: charData.portraitUrl,
                portraitSide: command.portraitSide ?? 'left',
            });
        } else {
            this.portraitSprite.visible = false;
            engine.setState('__sys_dialogue', {
                speaker: command.speaker,
                text: command.text,
                portraitUrl: null,
                portraitSide: null,
            });
        }

        const fullCharData = engine.manifest?.characters?.[speakerKey];
        if (fullCharData?.talkAnimation) {
            const spriteState = engine.getState('__sys_sprites');
            if (spriteState?.[command.speaker] || spriteState?.[speakerKey]) {
                const spriteId = spriteState[command.speaker] ? command.speaker : speakerKey;
                await engine.runCommand({
                    type: 'sprite',
                    id: spriteId,
                    action: 'animate',
                    animation: fullCharData.talkAnimation,
                });
            }
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

        if (command.instant) {
            this.messageText.text = tokens
                .filter((t): t is { type: 'text'; val: string } => t.type === 'text')
                .map(t => t.val)
                .join('');
            return;
        }

        for (const token of tokens) {
            if (session !== this.currentSession) return;

            if (engine.consumeSkip()) {
                const remaining = tokens
                    .slice(tokens.indexOf(token))
                    .filter((t): t is { type: 'text'; val: string } => t.type === 'text')
                    .map(t => t.val)
                    .join('');
                this.messageText.text = this.messageText.text + remaining;
                break;
            }

            if (token.type === 'wait') await new Promise(r => setTimeout(r, token.ms));
            else if (token.type === 'speed') currentSpeed = token.speed;
            else if (token.type === 'text') {
                await this.typewrite(token.val, currentSpeed, blipUrl, engine, session);
            }
        }

        if (session === this.currentSession && engine.autoAdvanceDelay !== null) {
            await new Promise(r => setTimeout(r, engine.autoAdvanceDelay!));
            if (session === this.currentSession) {
                engine.playNext();
            }
        }
    };

    private async typewrite(t: string, speed: number, blip: string | undefined, engine: Engine, session: number) {
        let current = this.messageText.text;
        let i = 0;
        while (i < t.length) {
            if (session !== this.currentSession) return;

            if (engine.consumeSkip()) {
                current += t.slice(i);
                this.messageText.text = current;
                return;
            }

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
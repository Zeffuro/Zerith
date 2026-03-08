import type { TextStyleOptions } from 'pixi.js';
import {sound} from '@pixi/sound';
import type {CommandHandler} from '../types';
import type {CharacterDefinition} from '../types';
import type {Engine} from '../Engine';
import { parseTextTags, transformShorthands } from '../utils/TextParser';
import { DialogueRenderer } from './dialogue/DialogueRenderer';
import { TypewriterController } from './dialogue/TypewriterController';

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
    public type: 'dialogue' = 'dialogue';
    public autoNext = false;
    private config: DialogueConfig;
    private readonly renderer: DialogueRenderer;
    private readonly typewriter: TypewriterController;
    private activeAbortController: AbortController | null = null;

    constructor(config: DialogueConfig) {
        this.config = { typewriterSpeed: 30, characters: {}, ...config };
        this.renderer = new DialogueRenderer(this.config);
        this.typewriter = new TypewriterController();
    }

    reset = () => {
        this.activeAbortController?.abort();
        this.activeAbortController = null;
        this.renderer.reset();
    };

    execute = async (command: DialogueCommand, engine: Engine) => {
        this.activeAbortController?.abort();
        const abortController = new AbortController();
        this.activeAbortController = abortController;
        const { signal } = abortController;

        engine.consumeSkip();
        this.renderer.ensureUI(engine);

        const resolvedText = engine.resolveText(command.text);

        const speakerKey = command.speaker.toLowerCase();
        const charData = this.config.characters?.[speakerKey] ||
            Object.entries(this.config.characters || {})
                .find(([k]) => k.toLowerCase() === speakerKey)?.[1];

        const displayName = charData?.displayName || command.speaker;

        engine.history.push(displayName, command.text);

        this.renderer.setSpeaker(displayName, charData?.nameColor || engine.theme.accentColor);

        if (charData?.portraitUrl) {
            await this.renderer.showPortrait(engine, charData.portraitUrl, command.portraitSide ?? 'left');
            if (signal.aborted) return;

            engine.setState('__sys_dialogue', {
                speaker: command.speaker,
                text: command.text,
                portraitUrl: charData.portraitUrl,
                portraitSide: command.portraitSide ?? 'left',
            });
        } else {
            this.renderer.hidePortrait();
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
                if (signal.aborted) return;
            }
        }

        const blipUrl = charData?.blipUrl || this.config.defaultBlipUrl;
        const resolvedBlipUrl = blipUrl ? engine.assetResolver(blipUrl) : undefined;
        if (resolvedBlipUrl) {
            try {
                if (!sound.exists(resolvedBlipUrl)) {
                    await new Promise((res, rej) => {
                        sound.add(resolvedBlipUrl, {
                            url: resolvedBlipUrl,
                            preload: true,
                            loaded: (err) => err ? rej(err) : res(null)
                        });
                    });
                }
            } catch (e) {
                engine.logger.warn(`Blip failed to load: ${blipUrl}`);
            }
            if (signal.aborted) return;
        }

        this.renderer.clearMessage();

        const transformed = transformShorthands(resolvedText);
        const tokens = parseTextTags(transformed);

        if (command.instant) {
            this.renderer.setMessageText(tokens
                .filter((t): t is { type: 'text'; val: string } => t.type === 'text')
                .map(t => t.val)
                .join(''));
            return;
        }

        await this.typewriter.run({
            tokens,
            initialSpeed: this.config.typewriterSpeed!,
            blipUrl: resolvedBlipUrl,
            signal,
            consumeSkip: () => engine.consumeSkip(),
            getMessageText: () => this.renderer.getMessageText(),
            setMessageText: (text) => this.renderer.setMessageText(text),
            getVoiceVolume: () => engine.audio.voiceVolume,
            createPromptBlinker: () => this.renderer.createPromptBlinker(),
            waitForPromptInput: (abortSignal) => this.waitForPromptInput(engine, abortSignal),
        });

        if (!signal.aborted && engine.autoAdvanceDelay !== null) {
            await this.waitForDelay(engine.autoAdvanceDelay, signal);
            if (!signal.aborted) {
                engine.playNext();
            }
        }
    };

    private async waitForPromptInput(engine: Engine, signal: AbortSignal): Promise<void> {
        if (signal.aborted) return;

        await new Promise<void>((resolve) => {
            let resolved = false;

            const cleanup = () => {
                engine.events.off('input:confirm', onInput);
                engine.events.off('input:next', onInput);
                signal.removeEventListener('abort', onAbort);
            };

            const finish = () => {
                if (resolved) return;
                resolved = true;
                cleanup();
                resolve();
            };

            const onInput = () => finish();
            const onAbort = () => finish();

            engine.events.on('input:confirm', onInput);
            engine.events.on('input:next', onInput);
            signal.addEventListener('abort', onAbort, { once: true });
        });
    }

    private async waitForDelay(ms: number, signal: AbortSignal): Promise<void> {
        if (signal.aborted || ms <= 0) return;

        await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
                signal.removeEventListener('abort', onAbort);
                resolve();
            }, ms);

            const onAbort = () => {
                clearTimeout(timeout);
                resolve();
            };

            signal.addEventListener('abort', onAbort, { once: true });
        });
    }
}
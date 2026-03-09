import type { TextStyleOptions } from 'pixi.js';

import { sound } from '@pixi/sound';

import type { ExecutionContext } from '../execution/ExecutionContext';
import type { CharacterDefinition } from '../types';
import type { CommandHandler } from '../types';
import type { BaseCommand } from '../types';
import type { SpriteCommand } from './SpriteHandler';

import { parseTextTags, transformShorthands } from '../utils/TextParser';
import { DialogueRenderer } from './dialogue/DialogueRenderer';
import { TypewriterController } from './dialogue/TypewriterController';

export interface DialogueCommand extends BaseCommand {
    instant?: boolean;
    portraitSide?: 'left' | 'right';
    speaker: string;
    text: string;
    type: 'dialogue';
}

export interface DialogueConfig {
    backgroundAlpha?: number;
    backgroundColor?: number;
    borderColor?: number;
    borderWidth?: number;
    boxHeight?: number;
    boxWidth?: number;
    boxX?: number;
    boxY?: number;
    characters?: Record<string, CharacterDefinition>;
    defaultBlipUrl?: string;
    messageStyle?: Partial<TextStyleOptions>;
    nameStyle?: Partial<TextStyleOptions>;
    typewriterSpeed?: number;
}

export class DialogueHandler implements CommandHandler<DialogueCommand> {
    public autoNext = false;
    public type = 'dialogue' as const;
    private activeAbortController: AbortController | undefined;
    private readonly config: DialogueConfig;
    private readonly renderer: DialogueRenderer;
    private readonly typewriter: TypewriterController;

    constructor(config: DialogueConfig) {
        this.config = { characters: {}, typewriterSpeed: 30, ...config };
        this.renderer = new DialogueRenderer(this.config);
        this.typewriter = new TypewriterController();
    }

    execute = async (command: DialogueCommand, engine: ExecutionContext) => {
        this.activeAbortController?.abort();
        const abortController = new AbortController();
        this.activeAbortController = abortController;
        const { signal } = abortController;

        engine.consumeSkip();
        this.renderer.ensureUI(engine);

        const resolvedText = engine.resolveText(command.text);

        const speakerKey = command.speaker.toLowerCase();
        const charData = (this.config.characters?.[speakerKey] ||
            Object.values(this.config.characters || {})
                .find((c) => c.name.toLowerCase() === speakerKey));

        const displayName = charData?.displayName || command.speaker;

        engine.history.push(displayName, command.text);

        this.renderer.setSpeaker(displayName, charData?.nameColor || engine.theme.accentColor);

        if (charData?.portraitUrl) {
            await this.renderer.showPortrait(engine, charData.portraitUrl, command.portraitSide ?? 'left');
            if (signal.aborted) return;

            engine.stateManager.system.dialogue = {
                portraitSide: command.portraitSide ?? 'left',
                portraitUrl: charData.portraitUrl,
                speaker: command.speaker,
                text: command.text,
            };
        } else {
            this.renderer.hidePortrait();
            engine.stateManager.system.dialogue = {
                portraitSide: undefined,
                portraitUrl: undefined,
                speaker: command.speaker,
                text: command.text,
            };
        }

        const fullCharData = engine.manifest?.characters?.[speakerKey];
        if (fullCharData?.talkAnimation) {
            const spriteState = engine.stateManager.system.sprites;
            if (spriteState?.[command.speaker] || spriteState?.[speakerKey]) {
                const spriteId = spriteState[command.speaker] ? command.speaker : speakerKey;
                const animCommand: SpriteCommand = {
                    action: 'animate',
                    animation: fullCharData.talkAnimation,
                    id: spriteId,
                    type: 'sprite',
                };
                await engine.runCommand(animCommand);
                if (signal.aborted) return;
            }
        }

        const blipUrl = charData?.blipUrl || this.config.defaultBlipUrl;
        const resolvedBlipUrl = blipUrl ? engine.assetResolver(blipUrl) : undefined;
        if (resolvedBlipUrl) {
            try {
                if (!sound.exists(resolvedBlipUrl)) {
                    await new Promise<void>((resolve, reject) => {
                        sound.add(resolvedBlipUrl, {
                            loaded: (error) => error ? reject(error) : resolve(),
                            preload: true,
                            url: resolvedBlipUrl
                        });
                    });
                }
            } catch {
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
            blipUrl: resolvedBlipUrl,
            consumeSkip: () => engine.consumeSkip(),
            createPromptBlinker: () => this.renderer.createPromptBlinker(),
            getMessageText: () => this.renderer.getMessageText(),
            getVoiceVolume: () => engine.audio.voiceVolume,
            initialSpeed: this.config.typewriterSpeed!,
            setMessageText: (text) => this.renderer.setMessageText(text),
            signal,
            tokens,
            waitForPromptInput: (abortSignal) => this.waitForPromptInput(engine, abortSignal),
        });

        if (!signal.aborted && engine.autoAdvanceDelay !== undefined) {
            await this.waitForDelay(engine.autoAdvanceDelay, signal);
            if (!signal.aborted) {
                void engine.playNext();
            }
        }
    };

    reset = () => {
        this.activeAbortController?.abort();
        this.activeAbortController = undefined;
        this.renderer.reset();
    };

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

    private async waitForPromptInput(engine: ExecutionContext, signal: AbortSignal): Promise<void> {
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
}
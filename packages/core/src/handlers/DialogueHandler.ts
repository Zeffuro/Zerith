import type { TextStyleOptions } from 'pixi.js';

import type { IAnimationManager, IAssetManager, IAudioManager, IDisplayManager, IEventBus, IFlowManager, IHistoryManager, IStateManager } from '../interfaces/managers';
import type { CharacterDefinition } from '../types';
import type { CommandHandler } from '../types';
import type { BaseCommand } from '../types';
import type { Logger } from '../utils/Logger';
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
    private readonly assets: IAssetManager;
    private readonly audio: IAudioManager;
    private autoAdvanceDelay: number | undefined;
    private readonly config: DialogueConfig;
    private readonly events: IEventBus;
    private readonly flow: IFlowManager;
    private readonly history: IHistoryManager;
    private readonly logger: Logger;
    private readonly renderer: DialogueRenderer;
    private readonly state: IStateManager;
    private readonly typewriter: TypewriterController;

    constructor(
        assets: IAssetManager,
        animations: IAnimationManager,
        audio: IAudioManager,
        display: IDisplayManager,
        events: IEventBus,
        flow: IFlowManager,
        history: IHistoryManager,
        logger: Logger,
        state: IStateManager,
        config: DialogueConfig,
    ) {
        this.assets = assets;
        this.audio = audio;
        this.events = events;
        this.flow = flow;
        this.history = history;
        this.logger = logger;
        this.state = state;
        this.config = { characters: {}, typewriterSpeed: 30, ...config };
        this.renderer = new DialogueRenderer(this.config, animations, display, this.assets);
        this.typewriter = new TypewriterController();
    }

    execute = async (command: DialogueCommand) => {
        this.activeAbortController?.abort();
        const abortController = new AbortController();
        this.activeAbortController = abortController;
        const { signal } = abortController;

        this.flow.consumeSkip();
        this.renderer.ensureUI();

        const resolvedText = this.resolveText(command.text, this.state);

        const speakerKey = command.speaker.toLowerCase();
        const charData = (this.config.characters?.[speakerKey] ||
            Object.values(this.config.characters || {})
                .find((c) => c.name.toLowerCase() === speakerKey));

        const displayName = charData?.displayName || command.speaker;

        this.history.push(displayName, command.text);

        this.renderer.setSpeaker(displayName, charData?.nameColor || '#7A6EF6');

        if (charData?.portraitUrl) {
            await this.renderer.showPortrait(charData.portraitUrl, command.portraitSide ?? 'left');
            if (signal.aborted) return;

            this.state.system.dialogue = {
                portraitSide: command.portraitSide ?? 'left',
                portraitUrl: charData.portraitUrl,
                speaker: command.speaker,
                text: command.text,
            };
        } else {
            this.renderer.hidePortrait();
            this.state.system.dialogue = {
                portraitSide: undefined,
                portraitUrl: undefined,
                speaker: command.speaker,
                text: command.text,
            };
        }

        const fullCharData = this.config.characters?.[speakerKey];
        if (fullCharData?.talkAnimation) {
            const spriteState = this.state.system.sprites;
            if (spriteState?.[command.speaker] || spriteState?.[speakerKey]) {
                const spriteId = spriteState[command.speaker] ? command.speaker : speakerKey;
                const animCommand: SpriteCommand = {
                    action: 'animate',
                    animation: fullCharData.talkAnimation,
                    id: spriteId,
                    type: 'sprite',
                };
                await this.flow.runCommand(animCommand);
                if (signal.aborted) return;
            }
        }

        const blipUrl = charData?.blipUrl || this.config.defaultBlipUrl;
        const resolvedBlipUrl = blipUrl ? this.assets.resolve(blipUrl) : undefined;
        if (resolvedBlipUrl) {
            try {
                if (!this.audio.audioExists(resolvedBlipUrl)) {
                    await this.audio.preloadAudio(resolvedBlipUrl);
                }
            } catch {
                this.logger.warn(`Blip failed to load: ${blipUrl}`);
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
            consumeSkip: () => this.flow.consumeSkip(),
            createPromptBlinker: () => this.renderer.createPromptBlinker(),
            getMessageText: () => this.renderer.getMessageText(),
            initialSpeed: this.config.typewriterSpeed!,
            playVoice: (url) => this.audio.playVoice(url),
            setMessageText: (text) => this.renderer.setMessageText(text),
            signal,
            tokens,
            waitForPromptInput: (abortSignal) => this.waitForPromptInput(this.events, abortSignal),
        });

        if (!signal.aborted && this.autoAdvanceDelay !== undefined) {
            await this.waitForDelay(this.autoAdvanceDelay, signal);
            if (!signal.aborted) {
                void this.flow.playNext();
            }
        }
    };

    public getAutoAdvanceDelay(): number | undefined {
        return this.autoAdvanceDelay;
    }

    reset = () => {
        this.activeAbortController?.abort();
        this.activeAbortController = undefined;
        this.renderer.reset();
    };

    public destroy(): void {
        this.reset();
    }

    public setAutoAdvanceDelay(delay: number | undefined) {
        this.autoAdvanceDelay = delay;
    }

    private resolveText(
        text: string,
        state: { get<T = unknown>(key: string): T | undefined; getPersistent<T = unknown>(key: string): T | undefined }
    ): string {
        return text.replaceAll(/{(\w+)}/g, (match: string, key: string) => {
            const value = state.get(key) ?? state.getPersistent(key);
            if (value === undefined || value === null) return match;
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                return `${value}`;
            }
            if (Array.isArray(value) || typeof value === 'object') {
                return JSON.stringify(value);
            }
            return match;
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

    private async waitForPromptInput(events: IEventBus, signal: AbortSignal): Promise<void> {
        if (signal.aborted) return;

        await new Promise<void>((resolve) => {
            let resolved = false;

            const cleanup = () => {
                events.off('input:confirm', onInput);
                events.off('input:next', onInput);
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

            events.on('input:confirm', onInput);
            events.on('input:next', onInput);
            signal.addEventListener('abort', onAbort, { once: true });
        });
    }

}
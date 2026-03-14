import type { TextStyleOptions } from 'pixi.js';

import type { IAnimationManager, IAssetManager, IAudioManager, IDisplayManager, IEventBus, IFlowManager, IHistoryManager, IStateManager } from '../interfaces/managers';
import type { CharacterDefinition } from '../types';
import type { CommandHandler } from '../types';
import type { BaseCommand } from '../types';
import type { Logger } from '../utils/Logger';
import type { SpriteCommand } from './SpriteHandler';

import { waitForAbortableDelay, waitForEventsOrAbort } from '../utils/AsyncHelpers';
import { parseTextTags, resolveTemplateText, transformShorthands } from '../utils/TextParser';
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

    public destroy(): void {
        this.reset();
    }

    execute = async (command: DialogueCommand) => {
        this.activeAbortController?.abort();
        const abortController = new AbortController();
        this.activeAbortController = abortController;
        const { signal } = abortController;

        this.flow.consumeSkip();
        this.renderer.ensureUI();

        const resolvedText = resolveTemplateText(command.text, this.state);

        const speaker = coerceSpeaker(command.speaker);
        const speakerKey = normalizeLower(speaker);
        const characters = this.config.characters ?? {};

        const charData = (
            (speakerKey ? characters[speakerKey] : undefined) ||
            (speakerKey
                ? Object.values(characters).find((character) => normalizeLower(character.name) === speakerKey)
                : undefined)
        );

        const displayName = charData?.displayName || (speaker || 'Narrator');

        this.history.push(displayName, command.text);

        this.renderer.setSpeaker(displayName, charData?.nameColor || '#7A6EF6');

        const portraitSide = command.portraitSide ?? 'left';
        await this.renderer.syncPortrait(charData?.portraitUrl, portraitSide);
        if (signal.aborted) return;

        this.state.system.dialogue = {
            portraitSide: charData?.portraitUrl ? portraitSide : undefined,
            portraitUrl: charData?.portraitUrl,
            speaker: speaker || displayName,
            text: command.text,
        };

        const fullCharData = speakerKey ? this.config.characters?.[speakerKey] : undefined;
        if (fullCharData?.talkAnimation) {
            const spriteState = this.state.system.sprites;
            if (speakerKey && (spriteState?.[speaker] || spriteState?.[speakerKey])) {
                const spriteId = spriteState[speaker] ? speaker : speakerKey;
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
            await waitForAbortableDelay(this.autoAdvanceDelay, signal);
            if (!signal.aborted) {
                void this.flow.playNext();
            }
        }
    };


    public getAutoAdvanceDelay(): number | undefined {
        return this.autoAdvanceDelay;
    }

    public reset = () => {
        this.activeAbortController?.abort();
        this.activeAbortController = undefined;
        this.renderer.reset();
    };


    public setAutoAdvanceDelay(delay: number | undefined) {
        this.autoAdvanceDelay = delay;
    }

    private async waitForPromptInput(events: IEventBus, signal: AbortSignal): Promise<void> {
        await waitForEventsOrAbort(events, ['input:confirm', 'input:next'], signal);
    }

}

function coerceSpeaker(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeLower(value: string | undefined): string | undefined {
    if (!value) return undefined;
    const normalized = value.trim().toLowerCase();
    return normalized.length > 0 ? normalized : undefined;
}


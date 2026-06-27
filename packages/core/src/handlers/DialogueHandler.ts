import type { TextStyleOptions } from 'pixi.js';

import type { IAnimationManager, IAssetManager, IAudioManager, IDisplayManager, IEventBus, IFlowManager, IHistoryManager, IStateManager } from '../interfaces/managers';
import type { DialogueAnnouncement, DialogueAnnouncementHandler } from '../types';
import type { CharacterDefinition } from '../types';
import type { CommandHandler } from '../types';
import type { BaseCommand } from '../types';
import type { Logger } from '../utils/Logger';
import type { TextMarkupMode } from '../utils/TextParser';
import type { SpriteCommand } from './SpriteHandler';

import { waitForAbortableDelay, waitForEventsOrAbort } from '../utils/AsyncHelpers';
import { parseDisplayTextTags, parseTextTags, resolveTemplateText, transformShorthands } from '../utils/TextParser';
import { DialogueRenderer } from './dialogue/DialogueRenderer';
import { TypewriterController } from './dialogue/TypewriterController';

export interface DialogueCommand extends BaseCommand {
    instant?: boolean;
    lineId?: string;
    portraitSide?: 'left' | 'right';
    speaker: string;
    text: string;
    type: 'dialogue';
}

export interface DialogueConfig {
    announceDialogue?: DialogueAnnouncementHandler;
    backgroundAlpha?: number;
    backgroundColor?: number;
    borderColor?: number;
    borderWidth?: number;
    boxHeight?: number;
    boxWidth?: number;
    boxX?: number;
    boxY?: number;
    captions?: boolean;
    characters?: Record<string, CharacterDefinition>;
    defaultBlipUrl?: string;
    markupMode?: TextMarkupMode;
    messageStyle?: Partial<TextStyleOptions>;
    nameStyle?: Partial<TextStyleOptions>;
    reducedMotion?: boolean;
    selfVoicing?: boolean;
    typewriterSpeed?: number;
}

export const DEFAULT_TYPEWRITER_SPEED_MS = 30;
export const MAX_TYPEWRITER_SPEED_MS = 120;

interface TalkingSpriteSnapshot {
    animation?: string;
    assetUrl?: string;
    id: string;
    pose?: string;
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
        this.config = {
            characters: {},
            markupMode: 'zerith',
            ...config,
            typewriterSpeed: normalizeTypewriterSpeed(config.typewriterSpeed),
        };
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

        this.history.push(displayName, resolvedText);

        this.renderer.setSpeaker(displayName, charData?.nameColor || '#7A6EF6');

        const portraitSide = command.portraitSide ?? 'left';
        await this.renderer.syncPortrait(charData?.portraitUrl, portraitSide);
        if (signal.aborted) return;

        this.state.system.dialogue = {
            portraitSide: charData?.portraitUrl ? portraitSide : undefined,
            portraitUrl: charData?.portraitUrl,
            speaker: speaker || displayName,
            text: resolvedText,
        };
        this.announceDialogueLine(command, displayName, resolvedText);

        const fullCharData = speakerKey ? this.config.characters?.[speakerKey] : undefined;
        let talkingSpriteSnapshot: TalkingSpriteSnapshot | undefined;
        if (fullCharData?.talkAnimation) {
            const spriteState = this.state.system.sprites;
            if (speakerKey && (spriteState?.[speaker] || spriteState?.[speakerKey])) {
                const spriteId = spriteState[speaker] ? speaker : speakerKey;
                const currentSprite = spriteState[spriteId];
                talkingSpriteSnapshot = currentSprite
                    ? {
                        animation: currentSprite.animation,
                        assetUrl: currentSprite.assetUrl,
                        id: spriteId,
                        pose: currentSprite.pose,
                    }
                    : undefined;
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
        const resolvedBlipUrl = blipUrl ? await this.assets.resolve(blipUrl) : undefined;
        let playableBlipUrl = resolvedBlipUrl;
        if (playableBlipUrl) {
            try {
                if (!this.audio.audioExists(playableBlipUrl)) {
                    await this.audio.preloadAudio(playableBlipUrl);
                }
            } catch {
                this.logger.warn(`Blip failed to load: ${blipUrl}`);
                playableBlipUrl = undefined;
            }
            if (signal.aborted) return;
        }

        this.renderer.clearMessage();

        try {
            const tokens = parseDisplayTextTags(resolvedText, this.config.markupMode);

            if (command.instant) {
                this.renderer.setMessageText(tokens
                    .filter((t): t is { type: 'text'; val: string } => t.type === 'text')
                    .map(t => t.val)
                    .join(''));
                return;
            }

            await this.typewriter.run({
                blipUrl: playableBlipUrl,
                consumeSkip: () => this.flow.consumeSkip(),
                createPromptBlinker: () => this.renderer.createPromptBlinker(),
                getMessageText: () => this.renderer.getMessageText(),
                initialSpeed: this.config.typewriterSpeed!,
                playVoice: (url) => this.audio.playVoice(url),
                reducedMotion: this.config.reducedMotion,
                setMessageText: (text) => this.renderer.setMessageText(text),
                signal,
                tokens,
                waitForPromptInput: (abortSignal) => this.waitForPromptInput(this.events, abortSignal),
            });
        } finally {
            if (talkingSpriteSnapshot?.animation && !signal.aborted) {
                await this.restoreTalkingSprite(talkingSpriteSnapshot);
            }
        }

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

    public getCaptionsEnabled(): boolean {
        return this.config.captions === true;
    }

    public getMarkupMode(): TextMarkupMode {
        return this.config.markupMode ?? 'zerith';
    }

    public getReducedMotion(): boolean {
        return this.config.reducedMotion === true;
    }

    public getSelfVoicingEnabled(): boolean {
        return this.config.selfVoicing === true;
    }

    public getTypewriterSpeed(): number {
        return normalizeTypewriterSpeed(this.config.typewriterSpeed);
    }

    public reset = () => {
        this.activeAbortController?.abort();
        this.activeAbortController = undefined;
        this.renderer.reset();
    };


    public setAutoAdvanceDelay(delay: number | undefined) {
        this.autoAdvanceDelay = delay;
    }

    public setCaptionsEnabled(captions: boolean) {
        this.config.captions = captions;
    }

    public setReducedMotion(reducedMotion: boolean) {
        this.config.reducedMotion = reducedMotion;
    }

    public setSelfVoicingEnabled(selfVoicing: boolean) {
        this.config.selfVoicing = selfVoicing;
    }

    public setTypewriterSpeed(speedMs: number) {
        this.config.typewriterSpeed = normalizeTypewriterSpeed(speedMs);
    }

    private announceDialogueLine(command: DialogueCommand, displayName: string, resolvedText: string): void {
        if (!shouldAnnounceDialogue(this.config)) return;

        const announceDialogue = this.config.announceDialogue;
        if (!announceDialogue) return;

        const announcement = createDialogueAnnouncement({
            captions: this.getCaptionsEnabled(),
            lineId: command.lineId,
            markupMode: this.config.markupMode,
            selfVoicing: this.getSelfVoicingEnabled(),
            speaker: displayName,
            text: resolvedText,
        });

        try {
            void Promise.resolve(announceDialogue(announcement)).catch((error: unknown) => {
                this.logger.warn(`Dialogue accessibility announcement failed: ${String(error)}`);
            });
        } catch (error) {
            this.logger.warn(`Dialogue accessibility announcement failed: ${String(error)}`);
        }
    }

    private async restoreTalkingSprite(snapshot: TalkingSpriteSnapshot): Promise<void> {
        const currentSprite = this.state.system.sprites[snapshot.id];
        if (!currentSprite) return;

        if (!snapshot.animation) return;

        await this.flow.runCommand({
            action: 'animate',
            animation: snapshot.animation,
            id: snapshot.id,
            type: 'sprite',
        });
    }

    private async waitForPromptInput(events: IEventBus, signal: AbortSignal): Promise<void> {
        await waitForEventsOrAbort(events, ['input:confirm', 'input:next'], signal);
    }

}

export function createDialogueAnnouncement(input: { markupMode?: TextMarkupMode } & DialogueAnnouncement): DialogueAnnouncement {
    const lineId = typeof input.lineId === 'string' && input.lineId.trim()
        ? input.lineId.trim()
        : undefined;

    return {
        captions: input.captions === true,
        ...(lineId === undefined ? {} : { lineId }),
        selfVoicing: input.selfVoicing === true,
        speaker: coerceSpeaker(input.speaker) || 'Narrator',
        text: toDialogueAnnouncementText(input.text, input.markupMode),
    };
}

export function shouldAnnounceDialogue(config: Pick<DialogueConfig, 'announceDialogue' | 'captions' | 'selfVoicing'>): boolean {
    return typeof config.announceDialogue === 'function'
        && (config.captions === true || config.selfVoicing === true);
}

export function toDialogueAnnouncementText(text: string, markupMode: TextMarkupMode = 'zerith'): string {
    const transformed = markupMode === 'zerith' ? transformShorthands(text) : text;
    const tokens = parseTextTags(transformed);
    const textWithMarkup = tokens
        .filter((token): token is { type: 'text'; val: string } => token.type === 'text')
        .map((token) => token.val)
        .join('');
    return markupMode === 'plain' ? textWithMarkup : stripHtmlForAnnouncement(textWithMarkup);
}

function coerceSpeaker(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeLower(value: string | undefined): string | undefined {
    if (!value) return undefined;
    const normalized = value.trim().toLowerCase();
    return normalized.length > 0 ? normalized : undefined;
}

function normalizeTypewriterSpeed(value: number | undefined): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return DEFAULT_TYPEWRITER_SPEED_MS;
    }
    return Math.round(Math.max(0, Math.min(MAX_TYPEWRITER_SPEED_MS, value)));
}

function stripHtmlForAnnouncement(text: string): string {
    return text
        .replaceAll(/<\s*br\s*\/?\s*>/giu, '\n')
        .replaceAll(/<[^>]*>/gu, '');
}


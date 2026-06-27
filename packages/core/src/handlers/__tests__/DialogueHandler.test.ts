import { describe, expect, it } from 'vitest';

import {
    createDialogueAnnouncement,
    DEFAULT_TYPEWRITER_SPEED_MS,
    DialogueHandler,
    MAX_TYPEWRITER_SPEED_MS,
    shouldAnnounceDialogue,
    toDialogueAnnouncementText,
} from '../DialogueHandler';

describe('DialogueHandler accessibility runtime settings', () => {
    it('updates reduced motion and clamps typewriter delay', () => {
        const handler = createDialogueHandler({
            reducedMotion: false,
            typewriterSpeed: DEFAULT_TYPEWRITER_SPEED_MS,
        });

        expect(handler.getReducedMotion()).toBe(false);
        handler.setReducedMotion(true);
        expect(handler.getReducedMotion()).toBe(true);

        handler.setTypewriterSpeed(-1);
        expect(handler.getTypewriterSpeed()).toBe(0);

        handler.setTypewriterSpeed(MAX_TYPEWRITER_SPEED_MS + 1);
        expect(handler.getTypewriterSpeed()).toBe(MAX_TYPEWRITER_SPEED_MS);

        handler.setTypewriterSpeed(Number.NaN);
        expect(handler.getTypewriterSpeed()).toBe(DEFAULT_TYPEWRITER_SPEED_MS);
    });

    it('updates caption and self-voicing runtime flags', () => {
        const handler = createDialogueHandler({
            captions: false,
            selfVoicing: false,
        });

        expect(handler.getCaptionsEnabled()).toBe(false);
        expect(handler.getSelfVoicingEnabled()).toBe(false);

        handler.setCaptionsEnabled(true);
        handler.setSelfVoicingEnabled(true);

        expect(handler.getCaptionsEnabled()).toBe(true);
        expect(handler.getSelfVoicingEnabled()).toBe(true);
    });

    it('creates plain-text dialogue announcements for caption and self-voicing hooks', () => {
        expect(toDialogueAnnouncementText('Hello <b>there</b>{wait:100}{p}!')).toBe('Hello there!');
        expect(toDialogueAnnouncementText('Hello <b>there</b>{wait:100}{p}!', 'plain')).toBe('Hello <b>there</b>!');

        expect(createDialogueAnnouncement({
            captions: true,
            lineId: ' intro.001 ',
            selfVoicing: false,
            speaker: ' ',
            text: 'Hi {speed:0}there',
        })).toEqual({
            captions: true,
            lineId: 'intro.001',
            selfVoicing: false,
            speaker: 'Narrator',
            text: 'Hi there',
        });
    });

    it('uses Zerith markup mode by default and exposes explicit overrides', () => {
        expect(createDialogueHandler({}).getMarkupMode()).toBe('zerith');
        expect(createDialogueHandler({ markupMode: 'plain' }).getMarkupMode()).toBe('plain');
    });

    it('requires an announcement callback and enabled feature flag', () => {
        expect(shouldAnnounceDialogue({ announceDialogue, captions: false, selfVoicing: false })).toBe(false);
        expect(shouldAnnounceDialogue({ announceDialogue, captions: true, selfVoicing: false })).toBe(true);
        expect(shouldAnnounceDialogue({ announceDialogue, captions: false, selfVoicing: true })).toBe(true);
        expect(shouldAnnounceDialogue({ captions: true, selfVoicing: true })).toBe(false);
    });
});

function announceDialogue() {}

function createDialogueHandler(config: ConstructorParameters<typeof DialogueHandler>[9]): DialogueHandler {
    return new DialogueHandler(
        {} as ConstructorParameters<typeof DialogueHandler>[0],
        {} as ConstructorParameters<typeof DialogueHandler>[1],
        {} as ConstructorParameters<typeof DialogueHandler>[2],
        {} as ConstructorParameters<typeof DialogueHandler>[3],
        {} as ConstructorParameters<typeof DialogueHandler>[4],
        {} as ConstructorParameters<typeof DialogueHandler>[5],
        {} as ConstructorParameters<typeof DialogueHandler>[6],
        {} as ConstructorParameters<typeof DialogueHandler>[7],
        {} as ConstructorParameters<typeof DialogueHandler>[8],
        config,
    );
}

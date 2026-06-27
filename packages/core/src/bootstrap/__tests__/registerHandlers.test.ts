import { describe, expect, it, vi } from 'vitest';

import { registerHandlers } from '../registerHandlers';

describe('registerHandlers', () => {
    it('passes accessibility runtime settings into the dialogue handler', () => {
        const registeredHandlers: unknown[] = [];
        const announceDialogue = vi.fn();

        const result = registerHandlers({
            accessibility: {
                announceDialogue,
                captions: true,
                reducedMotion: true,
                selfVoicing: true,
                typewriterSpeedMultiplier: 2,
            },
            animations: {},
            assets: {},
            audio: {},
            characters: {},
            display: {},
            events: {
                emit: vi.fn(),
                off: vi.fn(),
                on: vi.fn(),
                once: vi.fn(),
            },
            evidence: {},
            flow: {
                registerHandlers: (handlers: unknown[]) => {
                    registeredHandlers.push(...handlers);
                },
            },
            history: {},
            logger: {},
            manifestData: {},
            sceneManager: {},
            spritesheets: {},
            state: {},
            text: {
                markupMode: 'plain',
            },
            theme: {
                accentColor: 0xFF_AA_AA,
                borderColor: 0xAA_AA_FF,
                borderWidth: 4,
                boxAlpha: 0.9,
                boxColor: 0x00_00_55,
                fontFamily: 'Courier New',
                fontSize: 24,
                hoverColor: 0x33_33_99,
            },
        } as never);

        expect(result.dialogueHandler.getCaptionsEnabled()).toBe(true);
        expect(result.dialogueHandler.getReducedMotion()).toBe(true);
        expect(result.dialogueHandler.getSelfVoicingEnabled()).toBe(true);
        expect(result.dialogueHandler.getMarkupMode()).toBe('plain');
        expect(result.dialogueHandler.getTypewriterSpeed()).toBe(60);
        expect(registeredHandlers).toContain(result.dialogueHandler);
    });
});

import { describe, expect, it, vi } from 'vitest';

import { balanceTypewriterHtml, TypewriterController } from '../TypewriterController';

describe('balanceTypewriterHtml', () => {
    it('closes open nested formatting tags for intermediate typewriter frames', () => {
        expect(balanceTypewriterHtml('<b><span style="color: red;">AN')).toBe(
            '<b><span style="color: red;">AN</span></b>',
        );
    });

    it('leaves completed markup unchanged', () => {
        expect(balanceTypewriterHtml('<b><span style="color: red;">AN</span></b>')).toBe(
            '<b><span style="color: red;">AN</span></b>',
        );
    });
});

describe('TypewriterController', () => {
    it('renders balanced intermediate markup without changing the completed text', async () => {
        const frames: string[] = [];
        let messageText = '';

        await new TypewriterController().run({
            consumeSkip: () => false,
            createPromptBlinker: () => ({ destroy: vi.fn() }),
            getMessageText: () => messageText,
            initialSpeed: 0,
            playVoice: vi.fn(),
            setMessageText: (text) => {
                messageText = text;
                frames.push(text);
            },
            signal: new AbortController().signal,
            tokens: [{ type: 'text', val: '<b><span style="color: red;">AN</span></b>' }],
            waitForPromptInput: vi.fn(),
        });

        expect(frames).toContain('<b><span style="color: red;">A</span></b>');
        expect(messageText).toBe('<b><span style="color: red;">AN</span></b>');
    });

    it('does not persist temporary closing tags across wait tokens', async () => {
        const frames: string[] = [];
        let messageText = '';

        await new TypewriterController().run({
            consumeSkip: () => false,
            createPromptBlinker: () => ({ destroy: vi.fn() }),
            getMessageText: () => messageText,
            initialSpeed: 0,
            playVoice: vi.fn(),
            setMessageText: (text) => {
                messageText = text;
                frames.push(text);
            },
            signal: new AbortController().signal,
            tokens: [
                { type: 'text', val: '<b>Hi' },
                { ms: 0, type: 'wait' },
                { type: 'text', val: '</b>' },
            ],
            waitForPromptInput: vi.fn(),
        });

        expect(frames).toContain('<b>Hi</b>');
        expect(messageText).toBe('<b>Hi</b>');
    });

    it('continues rendering when cosmetic blip playback fails', async () => {
        let messageText = '';

        await expect(new TypewriterController().run({
            blipUrl: '/assets/sfx/missing.wav',
            consumeSkip: () => false,
            createPromptBlinker: () => ({ destroy: vi.fn() }),
            getMessageText: () => messageText,
            initialSpeed: 0,
            playVoice: vi.fn(() => Promise.reject(new Error('Unable to decode audio data'))),
            setMessageText: (text) => {
                messageText = text;
            },
            signal: new AbortController().signal,
            tokens: [{ type: 'text', val: 'Hi' }],
            waitForPromptInput: vi.fn(),
        })).resolves.toBeUndefined();

        expect(messageText).toBe('Hi');
    });

    it('skips typewriter and wait delays when reduced motion is enabled', async () => {
        let messageText = '';

        await new TypewriterController().run({
            consumeSkip: () => false,
            createPromptBlinker: () => ({ destroy: vi.fn() }),
            getMessageText: () => messageText,
            initialSpeed: 1000,
            playVoice: vi.fn(),
            reducedMotion: true,
            setMessageText: (text) => {
                messageText = text;
            },
            signal: new AbortController().signal,
            tokens: [
                { ms: 1000, type: 'wait' },
                { type: 'text', val: 'Hi' },
            ],
            waitForPromptInput: vi.fn(),
        });

        expect(messageText).toBe('Hi');
    });
});

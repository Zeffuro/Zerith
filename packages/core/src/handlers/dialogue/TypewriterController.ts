import { sound } from '@pixi/sound';
import type { Token } from '../../utils/TextParser';

export interface TypewriterRunOptions {
    tokens: Token[];
    initialSpeed: number;
    blipUrl?: string;
    signal: AbortSignal;
    consumeSkip: () => boolean;
    getMessageText: () => string;
    setMessageText: (text: string) => void;
    getVoiceVolume: () => number;
    createPromptBlinker: () => { destroy: () => void };
    waitForPromptInput: (signal: AbortSignal) => Promise<void>;
}

export class TypewriterController {
    public async run(options: TypewriterRunOptions): Promise<void> {
        const {
            tokens,
            initialSpeed,
            blipUrl,
            signal,
            consumeSkip,
            getMessageText,
            setMessageText,
            getVoiceVolume,
            createPromptBlinker,
            waitForPromptInput,
        } = options;

        let speed = initialSpeed;

        for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex++) {
            if (signal.aborted) return;
            const token = tokens[tokenIndex];

            if (token.type === 'prompt') {
                const blinker = createPromptBlinker();
                try {
                    await waitForPromptInput(signal);
                } finally {
                    blinker.destroy();
                }
            }

            if (signal.aborted) return;

            if (consumeSkip()) {
                const remaining = tokens
                    .slice(tokenIndex)
                    .filter((t): t is { type: 'text'; val: string } => t.type === 'text')
                    .map((t) => t.val)
                    .join('');
                setMessageText(getMessageText() + remaining);
                break;
            }

            if (token.type === 'wait') {
                await this.delay(token.ms, signal);
                continue;
            }

            if (token.type === 'speed') {
                speed = token.speed;
                continue;
            }

            if (token.type === 'text') {
                await this.typeText({
                    text: token.val,
                    speed,
                    blipUrl,
                    signal,
                    consumeSkip,
                    getMessageText,
                    setMessageText,
                    getVoiceVolume,
                });
            }
        }
    }

    private async typeText(options: {
        text: string;
        speed: number;
        blipUrl?: string;
        signal: AbortSignal;
        consumeSkip: () => boolean;
        getMessageText: () => string;
        setMessageText: (text: string) => void;
        getVoiceVolume: () => number;
    }) {
        const {
            text,
            speed,
            blipUrl,
            signal,
            consumeSkip,
            getMessageText,
            setMessageText,
            getVoiceVolume,
        } = options;

        let current = getMessageText();
        let i = 0;

        while (i < text.length) {
            if (signal.aborted) return;

            if (consumeSkip()) {
                current += text.slice(i);
                setMessageText(current);
                return;
            }

            if (text[i] === '<') {
                const end = text.indexOf('>', i);
                if (end === -1) {
                    current += text.slice(i);
                    i = text.length;
                } else {
                    current += text.slice(i, end + 1);
                    i = end + 1;
                }
            } else {
                const ch = text[i];
                current += ch;

                if (blipUrl && ch !== ' ' && ch !== '\n' && sound.exists(blipUrl)) {
                    sound.play(blipUrl, { volume: 0.1 * getVoiceVolume() });
                }
                i++;
            }

            setMessageText(current);
            if (speed > 0) {
                await this.delay(speed, signal);
            }
        }
    }

    private async delay(ms: number, signal: AbortSignal): Promise<void> {
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


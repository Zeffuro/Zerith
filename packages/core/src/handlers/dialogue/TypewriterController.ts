import type { Token } from '../../utils/TextParser';

export interface TypewriterRunOptions {
    blipUrl?: string;
    consumeSkip: () => boolean;
    createPromptBlinker: () => { destroy: () => void };
    getMessageText: () => string;
    initialSpeed: number;
    playVoice: (url: string) => Promise<void>;
    setMessageText: (text: string) => void;
    signal: AbortSignal;
    tokens: Token[];
    waitForPromptInput: (signal: AbortSignal) => Promise<void>;
}

export class TypewriterController {
    public async run(options: TypewriterRunOptions): Promise<void> {
        const {
            blipUrl,
            consumeSkip,
            createPromptBlinker,
            getMessageText,
            initialSpeed,
            playVoice,
            setMessageText,
            signal,
            tokens,
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
                    blipUrl,
                    consumeSkip,
                    getMessageText,
                    playVoice,
                    setMessageText,
                    signal,
                    speed,
                    text: token.val,
                });
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

    private async typeText(options: {
        blipUrl?: string;
        consumeSkip: () => boolean;
        getMessageText: () => string;
        playVoice: (url: string) => Promise<void>;
        setMessageText: (text: string) => void;
        signal: AbortSignal;
        speed: number;
        text: string;
    }) {
        const {
            blipUrl,
            consumeSkip,
            getMessageText,
            playVoice,
            setMessageText,
            signal,
            speed,
            text,
        } = options;

        let current = getMessageText();
        let index = 0;

        while (index < text.length) {
            if (signal.aborted) return;

            if (consumeSkip()) {
                current += text.slice(index);
                setMessageText(current);
                return;
            }

            if (text[index] === '<') {
                const end = text.indexOf('>', index);
                if (end === -1) {
                    current += text.slice(index);
                    index = text.length;
                } else {
                    current += text.slice(index, end + 1);
                    index = end + 1;
                }
            } else {
                const ch = text[index];
                current += ch;

                if (blipUrl && ch !== ' ' && ch !== '\n') {
                    await playVoice(blipUrl);
                }
                index++;
            }

            setMessageText(current);
            if (speed > 0) {
                await this.delay(speed, signal);
            }
        }
    }
}

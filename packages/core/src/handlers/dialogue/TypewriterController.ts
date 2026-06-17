import type { Token } from '../../utils/TextParser';

import { waitForAbortableDelay } from '../../utils/AsyncHelpers';

const VOID_HTML_TAGS = new Set([
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr',
]);

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
        let currentText = getMessageText();

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
                currentText += remaining;
                setMessageText(balanceTypewriterHtml(currentText));
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
                currentText = await this.typeText({
                    blipUrl,
                    consumeSkip,
                    currentText,
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
        await waitForAbortableDelay(ms, signal);
    }

    private async typeText(options: {
        blipUrl?: string;
        consumeSkip: () => boolean;
        currentText: string;
        playVoice: (url: string) => Promise<void>;
        setMessageText: (text: string) => void;
        signal: AbortSignal;
        speed: number;
        text: string;
    }) {
        const {
            blipUrl,
            consumeSkip,
            currentText,
            playVoice,
            setMessageText,
            signal,
            speed,
            text,
        } = options;

        let current = currentText;
        let index = 0;

        while (index < text.length) {
            if (signal.aborted) return current;

            if (consumeSkip()) {
                current += text.slice(index);
                setMessageText(balanceTypewriterHtml(current));
                return current;
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

            setMessageText(balanceTypewriterHtml(current));
            if (speed > 0) {
                await this.delay(speed, signal);
            }
        }

        return current;
    }
}

export function balanceTypewriterHtml(text: string): string {
    const openTags: string[] = [];
    const tagPattern = /<\s*(\/?)([a-zA-Z][\w:-]*)(?:\s[^>]*)?>/g;

    for (const match of text.matchAll(tagPattern)) {
        const rawTag = match[0];
        const tagName = match[2]?.toLowerCase();
        if (!tagName) continue;

        if (match[1] === '/') {
            closeMatchingTag(openTags, tagName);
            continue;
        }

        if (VOID_HTML_TAGS.has(tagName) || /\/\s*>$/.test(rawTag)) {
            continue;
        }

        openTags.push(tagName);
    }

    if (openTags.length === 0) {
        return text;
    }

    return `${text}${openTags.toReversed().map((tagName) => `</${tagName}>`).join('')}`;
}

function closeMatchingTag(openTags: string[], tagName: string): void {
    const index = openTags.lastIndexOf(tagName);
    if (index === -1) return;
    openTags.splice(index, 1);
}

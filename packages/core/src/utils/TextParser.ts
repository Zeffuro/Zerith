export type TextMarkupMode = 'html' | 'plain' | 'zerith';

export type Token =
    | { ms: number; type: 'wait', }
    | { speed: number; type: 'speed', }
    | { type: 'prompt' }
    | { type: 'text', val: string };

interface TextStateAccessor {
    get<T = unknown>(key: string): T | undefined;
    getPersistent<T = unknown>(key: string): T | undefined;
}

export function parseDisplayTextTags(text: string, markupMode: TextMarkupMode = 'zerith'): Token[] {
    const transformed = markupMode === 'zerith' ? transformShorthands(text) : text;
    const tokens = parseTextTags(transformed);
    if (markupMode !== 'plain') {
        return tokens;
    }

    return tokens.map((token) => (
        token.type === 'text'
            ? { type: 'text', val: escapeHtml(token.val) }
            : token
    ));
}

/**
 * Parses engine control tags: {wait:ms} and {speed:value}
 * Should be called AFTER transformShorthands.
 */
export function parseTextTags(text: string): Token[] {
    const tokens: Token[] = [];
    const regex = /\{(wait|speed):(\d+)}|\{p}/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            tokens.push({ type: 'text', val: text.slice(lastIndex, match.index) });
        }

        if (match[0] === '{p}') {
            tokens.push({ type: 'prompt' });
        } else {
            const [, type, value] = match;
            if (type === 'wait') tokens.push({ ms: Number.parseInt(value), type: 'wait' });
            if (type === 'speed') tokens.push({ speed: Number.parseInt(value), type: 'speed' });
        }

        lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
        tokens.push({ type: 'text', val: text.slice(lastIndex) });
    }

    return tokens;
}

/**
 * Transforms shorthand tags into valid HTML for PixiJS HTMLText.
 *
 * Supported shorthands:
 *   {color:red}text{/color}  → <span style="color: red;">text</span>
 *   {u color='red'}text{/u}  → <span style="text-decoration: underline; color: red;">text</span>
 *   {size:32}text{/size}     → <span style="font-size: 32px;">text</span>
 *
 * Standard HTML tags like <b>, <i>, <u> pass through untouched.
 */
export function resolveTemplateText(text: string, state: TextStateAccessor): string {
    return text.replaceAll(/{(\w+)}/g, (match: string, key: string) => {
        const value = state.get(key) ?? state.getPersistent(key);
        if (value === undefined || value === null) {
            return match;
        }

        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            return `${value}`;
        }

        if (Array.isArray(value) || typeof value === 'object') {
            return JSON.stringify(value);
        }

        return match;
    });
}

export function transformShorthands(text: string): string {
    // {color:value}...{/color} or {color='value'}...{/color}
    text = text.replaceAll(
        /\{color(?::|=['"]?)([^'"}]+)['"]?}([\s\S]*?)\{\/color}/g,
        (_m, color, content) => `<span style="color: ${color};">${content}</span>`
    );

    // {u color='value'}...{/u} or {u color="value"}...{/u}
    text = text.replaceAll(
        /\{u\s+color=['"](.*?)['"]}([\s\S]*?)\{\/u}/g,
        (_m, color, content) => `<span style="text-decoration: underline; color: ${color};">${content}</span>`
    );

    // {u}...{/u}
    text = text.replaceAll(
        /\{u}([\s\S]*?)\{\/u}/g,
        (_m, content) => `<span style="text-decoration: underline;">${content}</span>`
    );

    // {size:value}...{/size}
    text = text.replaceAll(
        /\{size:(\d+)}([\s\S]*?)\{\/size}/g,
        (_m, size, content) => `<span style="font-size: ${size}px;">${content}</span>`
    );

    return text;
}

function escapeHtml(text: string): string {
    return text
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}


export type Token =
    | { type: 'text', val: string }
    | { type: 'wait', ms: number }
    | { type: 'speed', speed: number }
    | { type: 'prompt' };

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
export function transformShorthands(text: string): string {
    // {color:value}...{/color}
    text = text.replace(
        /\{color:([^}]+)}([\s\S]*?)\{\/color}/g,
        (_m, color, content) => `<span style="color: ${color};">${content}</span>`
    );

    // {u color='value'}...{/u} or {u color="value"}...{/u}
    text = text.replace(
        /\{u\s+color=['"](.*?)['"]}([\s\S]*?)\{\/u}/g,
        (_m, color, content) => `<span style="text-decoration: underline; color: ${color};">${content}</span>`
    );

    // {size:value}...{/size}
    text = text.replace(
        /\{size:(\d+)}([\s\S]*?)\{\/size}/g,
        (_m, size, content) => `<span style="font-size: ${size}px;">${content}</span>`
    );

    return text;
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
            if (type === 'wait') tokens.push({ type: 'wait', ms: parseInt(value) });
            if (type === 'speed') tokens.push({ type: 'speed', speed: parseInt(value) });
        }

        lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
        tokens.push({ type: 'text', val: text.slice(lastIndex) });
    }

    return tokens;
}
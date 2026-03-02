export type Token =
    | { type: 'char', val: string }
    | { type: 'wait', ms: number }
    | { type: 'speed', speed: number };

export function parseTextTags(text: string): Token[] {
    const tokens: Token[] =[];
    let i = 0;
    while (i < text.length) {
        if (text[i] === '{') {
            const end = text.indexOf('}', i);
            if (end !== -1) {
                const tag = text.slice(i + 1, end);
                const [key, val] = tag.split(':');
                if (key === 'wait') tokens.push({ type: 'wait', ms: parseInt(val) || 500 });
                if (key === 'speed') tokens.push({ type: 'speed', speed: parseInt(val) || 30 });
                i = end + 1;
                continue;
            }
        }
        tokens.push({ type: 'char', val: text[i] });
        i++;
    }
    return tokens;
}
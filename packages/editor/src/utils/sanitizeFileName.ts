const WINDOWS_RESERVED_NAME_PATTERN = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const INVALID_FILE_NAME_CHARACTERS = new Set(String.raw`<>:"/\|?*`);

export function sanitizeFileName(name: string): string {
    let next = '';
    for (const character of name) {
        const codePoint = character.codePointAt(0) ?? 0;
        if (codePoint < 32 || INVALID_FILE_NAME_CHARACTERS.has(character)) {
            next += '_';
            continue;
        }

        next += character;
    }

    next = trimEdgeDotsAndSpaces(next.trim());

    if (next && WINDOWS_RESERVED_NAME_PATTERN.test(next)) {
        next = `_${next}`;
    }

    return next;
}

function trimEdgeDotsAndSpaces(value: string): string {
    let start = 0;
    let end = value.length;

    while (start < end && (value[start] === '.' || value[start] === ' ')) {
        start += 1;
    }

    while (end > start && (value[end - 1] === '.' || value[end - 1] === ' ')) {
        end -= 1;
    }

    return value.slice(start, end);
}


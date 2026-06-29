export type JsonSelectionPath = (number | string)[];

export type JsonSelectionRange = {
    end: number;
    start: number;
};

export function createJsonSelectionSignature(path: readonly (number | string)[] | undefined): string {
    return path?.join('\u001F') ?? '';
}

export function findJsonSelectionRange(
    sourceText: string,
    path: readonly (number | string)[],
): JsonSelectionRange | undefined {
    let cursor = 0;
    let found: JsonSelectionRange | undefined;

    for (const segment of path) {
        if (typeof segment === 'number') {
            const elementRange = findArrayElementRange(sourceText, cursor, segment);
            if (!elementRange) return found;
            found = elementRange;
            cursor = elementRange.start;
            continue;
        }

        const keyRange = findObjectKeyRange(sourceText, cursor, segment);
        if (!keyRange) return found;
        found = keyRange.key;
        cursor = keyRange.valueStart;
    }

    return found;
}

function findArrayElementRange(sourceText: string, cursor: number, targetIndex: number): JsonSelectionRange | undefined {
    if (targetIndex < 0) return;

    const arrayStart = skipWhitespace(sourceText, cursor);
    if (sourceText[arrayStart] !== '[') return;

    let elementIndex = 0;
    let position = arrayStart + 1;

    while (position < sourceText.length) {
        const start = skipWhitespace(sourceText, position);
        if (sourceText[start] === ']') return;

        const end = scanJsonValueEnd(sourceText, start);
        if (end === undefined) return;
        if (elementIndex === targetIndex) {
            return { end, start };
        }

        const separator = skipWhitespace(sourceText, end);
        if (sourceText[separator] !== ',') return;
        elementIndex += 1;
        position = separator + 1;
    }
}

function findObjectKeyRange(
    sourceText: string,
    cursor: number,
    key: string,
): { key: JsonSelectionRange; valueStart: number } | undefined {
    const keyLiteral = JSON.stringify(key);
    let searchFrom = cursor;

    while (searchFrom < sourceText.length) {
        const start = sourceText.indexOf(keyLiteral, searchFrom);
        if (start === -1) return;

        const end = start + keyLiteral.length;
        let colonIndex = skipWhitespace(sourceText, end);

        if (sourceText[colonIndex] === ':') {
            colonIndex += 1;
            return {
                key: { end, start },
                valueStart: skipWhitespace(sourceText, colonIndex),
            };
        }

        searchFrom = end;
    }
}

function scanJsonStringEnd(sourceText: string, start: number): number | undefined {
    let escaped = false;
    for (let position = start + 1; position < sourceText.length; position += 1) {
        const char = sourceText[position];
        if (escaped) {
            escaped = false;
            continue;
        }

        if (char === '\\') {
            escaped = true;
            continue;
        }

        if (char === '"') {
            return position + 1;
        }
    }
}

function scanJsonValueEnd(sourceText: string, start: number): number | undefined {
    const first = sourceText[start];
    if (first === '"') {
        return scanJsonStringEnd(sourceText, start);
    }

    if (first === '[' || first === '{') {
        return scanNestedJsonEnd(sourceText, start);
    }

    let position = start;
    while (position < sourceText.length && !/[,\]}]/u.test(sourceText[position])) {
        position += 1;
    }
    return position > start ? position : undefined;
}

function scanNestedJsonEnd(sourceText: string, start: number): number | undefined {
    const stack: string[] = [sourceText[start] === '[' ? ']' : '}'];
    let escaped = false;
    let inString = false;

    for (let position = start + 1; position < sourceText.length; position += 1) {
        const char = sourceText[position];

        if (inString) {
            if (escaped) {
                escaped = false;
                continue;
            }
            if (char === '\\') {
                escaped = true;
                continue;
            }
            if (char === '"') {
                inString = false;
            }
            continue;
        }

        if (char === '"') {
            inString = true;
            continue;
        }

        if (char === '[') {
            stack.push(']');
            continue;
        }

        if (char === '{') {
            stack.push('}');
            continue;
        }

        if (char === stack.at(-1)) {
            stack.pop();
            if (stack.length === 0) {
                return position + 1;
            }
        }
    }
}

function skipWhitespace(sourceText: string, cursor: number): number {
    let position = cursor;
    while (/\s/u.test(sourceText[position] ?? '')) {
        position += 1;
    }
    return position;
}

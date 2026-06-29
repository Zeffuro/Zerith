import { describe, expect, it } from 'vitest';

import { createJsonSelectionSignature, findJsonSelectionRange } from '../jsonSelectionModel';

describe('jsonSelectionModel', () => {
    it('finds object keys for existing file-json selections', () => {
        const source = '{\n  "scenes": {\n    "intro": "scenes/intro.json"\n  }\n}';

        expect(slice(source, findJsonSelectionRange(source, ['scenes', 'intro']))).toBe('"intro"');
    });

    it('finds nested array elements for Timeline command paths', () => {
        const source = JSON.stringify([
            { name: 'start', type: 'label' },
            {
                options: [
                    { commands: [{ label: 'start', type: 'goto' }] },
                    { commands: [{ to: 'ending', type: 'jump' }] },
                ],
                type: 'choice',
            },
        ], undefined, 2);

        expect(slice(source, findJsonSelectionRange(source, [1, 'options', 1, 'commands', 0]))).toContain('"type": "jump"');
    });

    it('creates stable mixed path signatures', () => {
        expect(createJsonSelectionSignature([1, 'options', 0, 'commands', 2])).toBe('1\u001Foptions\u001F0\u001Fcommands\u001F2');
    });
});

function slice(source: string, range: { end: number; start: number } | undefined): string | undefined {
    return range ? source.slice(range.start, range.end) : undefined;
}

import { describe, expect, it } from 'vitest';

import { parseTextTags, resolveTemplateText, transformShorthands } from '../TextParser';

function createState(values: Record<string, unknown>, persistent: Record<string, unknown> = {}) {
    return {
        get: <T = unknown>(key: string) => values[key] as T | undefined,
        getPersistent: <T = unknown>(key: string) => persistent[key] as T | undefined,
    };
}

describe('TextParser', () => {
    it('parses speed, wait, and prompt control tags while preserving surrounding text', () => {
        expect(parseTextTags('Fast {speed:12}now{wait:250}{p} done')).toEqual([
            { type: 'text', val: 'Fast ' },
            { speed: 12, type: 'speed' },
            { type: 'text', val: 'now' },
            { ms: 250, type: 'wait' },
            { type: 'prompt' },
            { type: 'text', val: ' done' },
        ]);
    });

    it('transforms inspector shorthand markup into HTMLText-compatible spans', () => {
        expect(transformShorthands("{color='red'}Alert{/color} {u}under{/u} {size:32}Big{/size}")).toBe(
            '<span style="color: red;">Alert</span> <span style="text-decoration: underline;">under</span> <span style="font-size: 32px;">Big</span>'
        );
    });

    it('keeps HTML tags and supports colored underline shorthand', () => {
        expect(transformShorthands("<b>Bold</b> {u color='blue'}link{/u}")).toBe(
            '<b>Bold</b> <span style="text-decoration: underline; color: blue;">link</span>'
        );
    });

    it('resolves state and persistent template variables without consuming control tags', () => {
        const state = createState({ count: 3, flag: true }, { player: 'Juno' });

        expect(resolveTemplateText('Hi {player}. Count {count}. Flag {flag}. {wait:100}', state)).toBe(
            'Hi Juno. Count 3. Flag true. {wait:100}'
        );
    });

    it('leaves missing template variables in place', () => {
        expect(resolveTemplateText('Missing {name}', createState({}))).toBe('Missing {name}');
    });
});

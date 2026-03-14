import type { ReactElement } from 'react';

import { describe, expect, it } from 'vitest';

import { editorTheme as t } from '../../../theme/editorTheme';
import { CommandPaletteFooterHint } from '../CommandPaletteFooterHint';

type FooterElementProperties = {
    children: string;
    style: {
        borderTop: string;
        color: string;
        fontSize: string;
        padding: string;
    };
};

describe('CommandPaletteFooterHint', () => {
    it('renders the key-hint copy', () => {
        const element = CommandPaletteFooterHint({ uiScale: 1 }) as ReactElement<FooterElementProperties>;

        expect(element.props.children).toBe('Enter to run - Esc to close - Up/Down to navigate');
    });

    it('applies border/text tokens and scales size/padding', () => {
        const element = CommandPaletteFooterHint({ uiScale: 2 }) as ReactElement<FooterElementProperties>;

        expect(element.props.style.borderTop).toBe(`1px solid ${t.border.subtle}`);
        expect(element.props.style.color).toBe(t.text.muted);
        expect(element.props.style.fontSize).toBe('22px');
        expect(element.props.style.padding).toBe('16px 24px');
    });
});


import type { ReactElement } from 'react';

import { describe, expect, it } from 'vitest';

import { editorTheme as t } from '../../../theme/editorTheme';
import { CommandPaletteEmptyState } from '../CommandPaletteEmptyState';

type EmptyStateProperties = {
    children: string;
    style: {
        color: string;
        fontStyle: string;
        padding: string;
    };
};

describe('CommandPaletteEmptyState', () => {
    it('renders empty-state copy and styling tokens', () => {
        const element = CommandPaletteEmptyState({ uiScale: 2 }) as ReactElement<EmptyStateProperties>;

        expect(element.props.children).toBe('No matching commands');
        expect(element.props.style.color).toBe(t.text.faint);
        expect(element.props.style.fontStyle).toBe('italic');
        expect(element.props.style.padding).toBe('20px 24px');
    });
});


import type { ReactElement } from 'react';

import { describe, expect, it, vi } from 'vitest';

import { editorTheme as t } from '../../../theme/editorTheme';
import { CommandPaletteActionRow } from '../CommandPaletteActionRow';

type ActionRowButtonProperties = {
    children: ReactElement[];
    onClick: () => void;
    style: {
        background: string;
        color: string;
    };
};

type ActionRowLabelProperties = {
    children: string;
};

describe('CommandPaletteActionRow', () => {
    it('renders label and hint text from the action payload', () => {
        const element = CommandPaletteActionRow({
            action: { hintText: 'Ctrl+S', id: 'save', label: 'Save Active File' },
            isActive: false,
            onClick: () => {},
            uiScale: 1,
        }) as ReactElement<ActionRowButtonProperties>;

        const [labelElement, hintElement] = element.props.children as ReactElement<ActionRowLabelProperties>[];
        expect(labelElement.props.children).toBe('Save Active File');
        expect(hintElement.props.children).toBe('Ctrl+S');
    });

    it('uses active and inactive style contracts', () => {
        const activeElement = CommandPaletteActionRow({
            action: { hintText: '', id: 'play', label: 'Playback: Play' },
            isActive: true,
            onClick: () => {},
            uiScale: 1,
        }) as ReactElement<ActionRowButtonProperties>;

        const inactiveElement = CommandPaletteActionRow({
            action: { hintText: '', id: 'play', label: 'Playback: Play' },
            isActive: false,
            onClick: () => {},
            uiScale: 1,
        }) as ReactElement<ActionRowButtonProperties>;

        expect(activeElement.props.style.background).toBe(t.bg.selected);
        expect(activeElement.props.style.color).toBe(t.text.primary);
        expect(inactiveElement.props.style.background).toBe('transparent');
        expect(inactiveElement.props.style.color).toBe(t.text.normal);
    });

    it('wires click callback to the button onClick handler', () => {
        const onClick = vi.fn();
        const element = CommandPaletteActionRow({
            action: { hintText: '', id: 'play', label: 'Playback: Play' },
            isActive: false,
            onClick,
            uiScale: 1,
        }) as ReactElement<ActionRowButtonProperties>;

        element.props.onClick();

        expect(onClick).toHaveBeenCalledTimes(1);
    });
});


import type { ReactElement } from 'react';

import { describe, expect, it, vi } from 'vitest';

import { editorTheme as t } from '../../../theme/editorTheme';
import { CommandPaletteShell } from '../CommandPaletteShell';

type BackdropProperties = {
    children: ReactElement;
    onClick: () => void;
    style: {
        background: string;
        zIndex: number;
    };
};

type PanelProperties = {
    children: string;
    onClick: (event: { stopPropagation: () => void }) => void;
    style: {
        background: string;
        border: string;
        marginTop: string;
        maxHeight: string;
        maxWidth: string;
        width: string;
    };
};

describe('CommandPaletteShell', () => {
    it('wires backdrop click to close callback', () => {
        const onRequestClose = vi.fn();
        const element = CommandPaletteShell({
            children: 'content',
            onRequestClose,
            uiScale: 1,
        }) as ReactElement<BackdropProperties>;

        element.props.onClick();

        expect(onRequestClose).toHaveBeenCalledTimes(1);
    });

    it('stops click propagation inside the panel', () => {
        const element = CommandPaletteShell({
            children: 'content',
            onRequestClose: () => {},
            uiScale: 1,
        }) as ReactElement<BackdropProperties>;

        const panelElement = element.props.children as ReactElement<PanelProperties>;
        const stopPropagation = vi.fn();

        panelElement.props.onClick({ stopPropagation });

        expect(stopPropagation).toHaveBeenCalledTimes(1);
    });

    it('applies shell style tokens and scaled panel dimensions', () => {
        const element = CommandPaletteShell({
            children: 'content',
            onRequestClose: () => {},
            uiScale: 2,
        }) as ReactElement<BackdropProperties>;

        expect(element.props.style.background).toBe('rgba(0, 0, 0, 0.45)');
        expect(element.props.style.zIndex).toBe(5200);

        const panelElement = element.props.children as ReactElement<PanelProperties>;
        expect(panelElement.props.style.background).toBe(t.bg.popup);
        expect(panelElement.props.style.border).toBe(`1px solid ${t.border.normal}`);
        expect(panelElement.props.style.marginTop).toBe('104px');
        expect(panelElement.props.style.maxHeight).toBe('min(70vh, 1120px)');
        expect(panelElement.props.style.maxWidth).toBe('min(92vw, 1640px)');
        expect(panelElement.props.style.width).toBe('min(92vw, 1360px)');
    });
});


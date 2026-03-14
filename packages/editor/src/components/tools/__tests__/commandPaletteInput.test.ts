import type { ReactElement } from 'react';

import { describe, expect, it, vi } from 'vitest';

import { editorTheme as t } from '../../../theme/editorTheme';
import { CommandPaletteInput } from '../CommandPaletteInput';

type InputElementProperties = {
    autoFocus: boolean;
    onChange: (event: { target: { value: string } }) => void;
    onKeyDown: (event: unknown) => void;
    placeholder: string;
    style: {
        borderBottom: string;
        fontSize: string;
        padding: string;
    };
    value: string;
};

describe('CommandPaletteInput', () => {
    it('renders placeholder and query value', () => {
        const onInputChange = vi.fn();
        const onInputKeyDown = vi.fn();

        const element = CommandPaletteInput({
            onInputChange,
            onInputKeyDown,
            query: 'save',
            uiScale: 1,
        }) as ReactElement<InputElementProperties>;

        expect(element.props.placeholder).toBe('Type an action (e.g. Save All, Play, Reset Layout)');
        expect(element.props.value).toBe('save');
        expect(element.props.autoFocus).toBe(true);
    });

    it('forwards onChange values and keydown events', () => {
        const onInputChange = vi.fn();
        const onInputKeyDown = vi.fn();

        const element = CommandPaletteInput({
            onInputChange,
            onInputKeyDown,
            query: '',
            uiScale: 1,
        }) as ReactElement<InputElementProperties>;

        element.props.onChange({ target: { value: 'play' } });
        element.props.onKeyDown({ key: 'Enter' });

        expect(onInputChange).toHaveBeenCalledWith('play');
        expect(onInputKeyDown).toHaveBeenCalledWith({ key: 'Enter' });
    });

    it('applies scaled style tokens', () => {
        const element = CommandPaletteInput({
            onInputChange: () => {},
            onInputKeyDown: () => {},
            query: '',
            uiScale: 2,
        }) as ReactElement<InputElementProperties>;

        expect(element.props.style.borderBottom).toBe(`1px solid ${t.border.subtle}`);
        expect(element.props.style.fontSize).toBe('26px');
        expect(element.props.style.padding).toBe('20px 24px');
    });
});


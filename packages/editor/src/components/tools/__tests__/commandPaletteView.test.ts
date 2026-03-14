import type { ReactElement } from 'react';

import { describe, expect, it, vi } from 'vitest';

import { CommandPaletteFooterHint } from '../CommandPaletteFooterHint';
import { CommandPaletteInput } from '../CommandPaletteInput';
import { CommandPaletteResultsList } from '../CommandPaletteResultsList';
import { CommandPaletteShell } from '../CommandPaletteShell';
import { CommandPaletteView } from '../CommandPaletteView';

type ResultsListProperties = {
    actions: Array<{ hintText: string; id: string; label: string }>;
    onActionClick: (index: number) => void;
    selectedIndex: number;
    showEmptyState: boolean;
    uiScale: number;
};

type ShellProperties = {
    children: ReactElement[];
    onRequestClose: () => void;
    uiScale: number;
};

describe('CommandPaletteView', () => {
    it('composes shell, input, results list, and footer with forwarded props', () => {
        const actions = [{ hintText: 'Ctrl+S', id: 'save', label: 'Save' }];
        const onActionClick = vi.fn();
        const onRequestClose = vi.fn();

        const element = CommandPaletteView({
            actions,
            onActionClick,
            onInputChange: () => {},
            onInputKeyDown: () => {},
            onRequestClose,
            query: 'save',
            selectedIndex: 0,
            showEmptyState: false,
            uiScale: 1.5,
        }) as ReactElement<ShellProperties>;

        expect(element.type).toBe(CommandPaletteShell);
        const shellProperties = element.props;
        expect(shellProperties.onRequestClose).toBe(onRequestClose);
        expect(shellProperties.uiScale).toBe(1.5);

        const [inputElement, resultsListElement, footerElement] = shellProperties.children;

        expect(inputElement.type).toBe(CommandPaletteInput);
        expect(resultsListElement.type).toBe(CommandPaletteResultsList);
        expect(footerElement.type).toBe(CommandPaletteFooterHint);

        const resultsListProperties = resultsListElement.props as ResultsListProperties;
        expect(resultsListProperties.actions).toBe(actions);
        expect(resultsListProperties.onActionClick).toBe(onActionClick);
        expect(resultsListProperties.selectedIndex).toBe(0);
        expect(resultsListProperties.showEmptyState).toBe(false);
        expect(resultsListProperties.uiScale).toBe(1.5);
    });
});


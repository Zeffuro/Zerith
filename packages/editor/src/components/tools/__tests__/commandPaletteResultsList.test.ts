import type { ReactElement } from 'react';

import { describe, expect, it, vi } from 'vitest';

import { CommandPaletteActionRow } from '../CommandPaletteActionRow';
import { CommandPaletteEmptyState } from '../CommandPaletteEmptyState';
import { CommandPaletteResultsList } from '../CommandPaletteResultsList';

type EmptyStateComponentProperties = {
    uiScale: number;
};

type ResultsListProperties = {
    children: ReactElement[];
    className: string;
    style: {
        maxHeight: string;
        overflowY: string;
    };
};

type RowProperties = {
    onClick: () => void;
};

function flattenChildren(children: unknown): ReactElement[] {
    if (Array.isArray(children)) {
        return children.flatMap((child) => flattenChildren(child));
    }

    return children ? [children as ReactElement] : [];
}

describe('CommandPaletteResultsList', () => {
    it('renders empty-state component and forwards uiScale when enabled', () => {
        const element = CommandPaletteResultsList({
            actions: [],
            onActionClick: () => {},
            selectedIndex: 0,
            showEmptyState: true,
            uiScale: 2,
        }) as ReactElement<ResultsListProperties>;

        expect(element.props.className).toBe('zerith-scrollbar');
        expect(element.props.style.maxHeight).toBe('min(60vh, 1000px)');
        expect(element.props.style.overflowY).toBe('auto');

        const children = flattenChildren(element.props.children);
        const emptyStateElements = children
            .filter((child) => child.type === CommandPaletteEmptyState) as ReactElement<EmptyStateComponentProperties>[];

        expect(emptyStateElements).toHaveLength(1);
        expect(emptyStateElements[0].props.uiScale).toBe(2);
    });

    it('does not render empty-state component when disabled', () => {
        const element = CommandPaletteResultsList({
            actions: [{ hintText: '', id: 'save', label: 'Save' }],
            onActionClick: () => {},
            selectedIndex: 0,
            showEmptyState: false,
            uiScale: 1,
        }) as ReactElement<ResultsListProperties>;

        const children = flattenChildren(element.props.children);
        const emptyStateElements = children.filter((child) => child.type === CommandPaletteEmptyState);

        expect(emptyStateElements).toHaveLength(0);
    });

    it('renders one row per action and forwards index click callbacks', () => {
        const onActionClick = vi.fn();
        const element = CommandPaletteResultsList({
            actions: [
                { hintText: 'Ctrl+S', id: 'save', label: 'Save' },
                { hintText: '', id: 'play', label: 'Play' },
            ],
            onActionClick,
            selectedIndex: 1,
            showEmptyState: false,
            uiScale: 1,
        }) as ReactElement<ResultsListProperties>;

        const rowElements = flattenChildren(element.props.children)
            .filter((child) => child.type === CommandPaletteActionRow) as ReactElement<RowProperties>[];

        expect(rowElements).toHaveLength(2);

        rowElements[0].props.onClick();
        rowElements[1].props.onClick();

        expect(onActionClick).toHaveBeenNthCalledWith(1, 0);
        expect(onActionClick).toHaveBeenNthCalledWith(2, 1);
    });
});


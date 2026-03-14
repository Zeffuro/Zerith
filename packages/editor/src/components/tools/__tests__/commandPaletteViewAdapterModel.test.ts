import type { KeyboardEvent } from 'react';

import { describe, expect, it, vi } from 'vitest';

import { buildCommandPaletteViewProperties } from '../commandPaletteViewAdapterModel';

describe('commandPaletteViewAdapterModel', () => {
    it('maps filtered actions to renderable rows and derived view flags', () => {
        const properties = buildCommandPaletteViewProperties({
            filteredActions: [
                { execute: () => {}, hint: 'Ctrl+S', id: 'save', keywords: 'save', label: 'Save' },
                { execute: () => {}, id: 'play', keywords: 'play', label: 'Play' },
            ],
            onInputKeyDown: () => {},
            onRequestClose: () => {},
            onRunAction: () => {},
            query: 's',
            selectedIndex: 9,
            setQuery: () => {},
            setSelectedIndex: () => {},
            uiScale: 1,
        });

        expect(properties.actions).toEqual([
            { hintText: 'Ctrl+S', id: 'save', label: 'Save' },
            { hintText: '', id: 'play', label: 'Play' },
        ]);
        expect(properties.selectedIndex).toBe(1);
        expect(properties.showEmptyState).toBe(false);
    });

    it('shows empty state and resets selection on input change', () => {
        const setQuery = vi.fn();
        const setSelectedIndex = vi.fn();

        const properties = buildCommandPaletteViewProperties({
            filteredActions: [],
            onInputKeyDown: () => {},
            onRequestClose: () => {},
            onRunAction: () => {},
            query: '',
            selectedIndex: 4,
            setQuery,
            setSelectedIndex,
            uiScale: 1,
        });

        expect(properties.showEmptyState).toBe(true);
        expect(properties.selectedIndex).toBe(0);

        properties.onInputChange('save');
        expect(setQuery).toHaveBeenCalledWith('save');
        expect(setSelectedIndex).toHaveBeenCalledWith(0);
    });

    it('forwards action click, keydown, close callback, and scalar props', () => {
        const onRunAction = vi.fn();
        const onRequestClose = vi.fn();
        const onInputKeyDown = vi.fn();

        const properties = buildCommandPaletteViewProperties({
            filteredActions: [{ execute: () => {}, id: 'save', keywords: 'save', label: 'Save' }],
            onInputKeyDown,
            onRequestClose,
            onRunAction,
            query: 'save',
            selectedIndex: 0,
            setQuery: () => {},
            setSelectedIndex: () => {},
            uiScale: 1.5,
        });

        properties.onActionClick(3);
        properties.onInputKeyDown({ key: 'Enter' } as KeyboardEvent<HTMLInputElement>);
        properties.onRequestClose();

        expect(onRunAction).toHaveBeenCalledWith(3);
        expect(onInputKeyDown).toHaveBeenCalledTimes(1);
        expect(onRequestClose).toHaveBeenCalledTimes(1);
        expect(properties.query).toBe('save');
        expect(properties.uiScale).toBe(1.5);
    });
});


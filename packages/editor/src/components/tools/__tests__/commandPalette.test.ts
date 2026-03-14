import type { ReactElement } from 'react';

import { describe, expect, it, vi } from 'vitest';

const { commandPaletteViewMock, useCommandPaletteControllerMock } = vi.hoisted(() => ({
    commandPaletteViewMock: vi.fn((properties) => ({ props: properties, type: 'mock-view' })),
    useCommandPaletteControllerMock: vi.fn(() => ({
        actions: [] as Array<{ hintText: string; id: string; label: string }>,
        onActionClick: () => {},
        onInputChange: () => {},
        onInputKeyDown: () => {},
        onRequestClose: () => {},
        query: '',
        selectedIndex: 0,
        showEmptyState: true,
        uiScale: 1,
    })),
}));

vi.mock('../CommandPaletteView', () => ({
    CommandPaletteView: commandPaletteViewMock,
}));

vi.mock('../useCommandPaletteController', () => ({
    useCommandPaletteController: useCommandPaletteControllerMock,
}));

import { CommandPalette } from '../CommandPalette';

describe('CommandPalette', () => {
    it('forwards props to controller hook and renders returned view props', () => {
        const onRequestClose = vi.fn();
        const controllerViewProperties = {
            actions: [{ hintText: '', id: 'save', label: 'Save' }],
            onActionClick: vi.fn(),
            onInputChange: vi.fn(),
            onInputKeyDown: vi.fn(),
            onRequestClose,
            query: 'save',
            selectedIndex: 0,
            showEmptyState: false,
            uiScale: 1.5,
        };
        useCommandPaletteControllerMock.mockReturnValueOnce(controllerViewProperties);

        const element = CommandPalette({ onRequestClose, uiScale: 1.5 }) as ReactElement;

        expect(useCommandPaletteControllerMock).toHaveBeenCalledWith({ onRequestClose, uiScale: 1.5 });
        expect(element.type).toBe(commandPaletteViewMock);
        expect(element.props).toStrictEqual(controllerViewProperties);
    });
});


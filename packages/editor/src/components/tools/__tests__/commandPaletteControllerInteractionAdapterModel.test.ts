import { describe, expect, it, vi } from 'vitest';

import { buildCommandPaletteControllerInteractions } from '../commandPaletteControllerInteractionAdapterModel';

describe('commandPaletteControllerInteractionAdapterModel', () => {
    it('forwards exact builder arguments and returns builder outputs unchanged', () => {
        const filteredActions = [{ execute: vi.fn(), id: 'save', keywords: 'save', label: 'Save' }];
        const onRequestClose = vi.fn();
        const setSelectedIndex = vi.fn();

        const handleKeyDown = vi.fn();
        const handleActionClick = vi.fn();

        const buildInputKeyDownHandler = vi.fn(() => handleKeyDown);
        const buildActionClickHandler = vi.fn(() => handleActionClick);

        const result = buildCommandPaletteControllerInteractions(
            {
                filteredActions,
                onRequestClose,
                selectedIndex: 3,
                setSelectedIndex,
            },
            {
                buildActionClickHandler,
                buildInputKeyDownHandler,
            },
        );

        expect(buildInputKeyDownHandler).toHaveBeenCalledWith({
            filteredActions,
            onRequestClose,
            selectedIndex: 3,
            setSelectedIndex,
        });
        expect(buildActionClickHandler).toHaveBeenCalledWith({
            filteredActions,
            onRequestClose,
        });

        expect(result.handleKeyDown).toBe(handleKeyDown);
        expect(result.handleActionClick).toBe(handleActionClick);
    });

    it('does not execute returned handlers during assembly', () => {
        const handleKeyDown = vi.fn();
        const handleActionClick = vi.fn();

        const result = buildCommandPaletteControllerInteractions(
            {
                filteredActions: [{ execute: vi.fn(), id: 'save', keywords: 'save', label: 'Save' }],
                onRequestClose: vi.fn(),
                selectedIndex: 0,
                setSelectedIndex: vi.fn(),
            },
            {
                buildActionClickHandler: () => handleActionClick,
                buildInputKeyDownHandler: () => handleKeyDown,
            },
        );

        expect(handleKeyDown).not.toHaveBeenCalled();
        expect(handleActionClick).not.toHaveBeenCalled();
        expect(typeof result.handleKeyDown).toBe('function');
        expect(typeof result.handleActionClick).toBe('function');
    });
});


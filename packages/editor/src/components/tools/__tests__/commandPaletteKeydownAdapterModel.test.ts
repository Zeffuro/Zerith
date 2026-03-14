import { describe, expect, it, vi } from 'vitest';

import { buildCommandPaletteInputKeyDownHandler } from '../commandPaletteKeydownAdapterModel';

function createKeyEvent(key: string) {
    return {
        key,
        preventDefault: vi.fn(),
    };
}

describe('commandPaletteKeydownAdapterModel', () => {
    it('updates selection for arrow keys and prevents default', () => {
        const setSelectedIndex = vi.fn();
        const onRequestClose = vi.fn();
        const onExecute = vi.fn();

        const filteredActions = [
            { execute: onExecute, id: 'save', keywords: 'save', label: 'Save' },
            { execute: onExecute, id: 'play', keywords: 'play', label: 'Play' },
        ];

        const handleKeyDown = buildCommandPaletteInputKeyDownHandler({
            filteredActions,
            onRequestClose,
            selectedIndex: 0,
            setSelectedIndex,
        });

        const downEvent = createKeyEvent('ArrowDown');
        handleKeyDown(downEvent as never);

        expect(downEvent.preventDefault).toHaveBeenCalledTimes(1);
        expect(setSelectedIndex).toHaveBeenCalledWith(1);

        const upEvent = createKeyEvent('ArrowUp');
        handleKeyDown(upEvent as never);

        expect(upEvent.preventDefault).toHaveBeenCalledTimes(1);
        expect(setSelectedIndex).toHaveBeenLastCalledWith(0);
        expect(onRequestClose).not.toHaveBeenCalled();
    });

    it('executes selected action on enter and closes after execution', async () => {
        const setSelectedIndex = vi.fn();
        const onRequestClose = vi.fn();
        const executeSelected = vi.fn();

        const filteredActions = [
            { execute: vi.fn(), id: 'save', keywords: 'save', label: 'Save' },
            { execute: executeSelected, id: 'play', keywords: 'play', label: 'Play' },
        ];

        const handleKeyDown = buildCommandPaletteInputKeyDownHandler({
            filteredActions,
            onRequestClose,
            selectedIndex: 1,
            setSelectedIndex,
        });

        const event = createKeyEvent('Enter');
        handleKeyDown(event as never);
        await Promise.resolve();

        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        expect(executeSelected).toHaveBeenCalledTimes(1);
        expect(onRequestClose).toHaveBeenCalledTimes(1);
        expect(setSelectedIndex).not.toHaveBeenCalled();
    });

    it('closes on escape and prevents default', () => {
        const setSelectedIndex = vi.fn();
        const onRequestClose = vi.fn();

        const handleKeyDown = buildCommandPaletteInputKeyDownHandler({
            filteredActions: [],
            onRequestClose,
            selectedIndex: 0,
            setSelectedIndex,
        });

        const event = createKeyEvent('Escape');
        handleKeyDown(event as never);

        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        expect(onRequestClose).toHaveBeenCalledTimes(1);
        expect(setSelectedIndex).not.toHaveBeenCalled();
    });

    it('ignores unsupported keys without preventing default', () => {
        const setSelectedIndex = vi.fn();
        const onRequestClose = vi.fn();

        const handleKeyDown = buildCommandPaletteInputKeyDownHandler({
            filteredActions: [],
            onRequestClose,
            selectedIndex: 0,
            setSelectedIndex,
        });

        const event = createKeyEvent('Tab');
        handleKeyDown(event as never);

        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(onRequestClose).not.toHaveBeenCalled();
        expect(setSelectedIndex).not.toHaveBeenCalled();
    });
});


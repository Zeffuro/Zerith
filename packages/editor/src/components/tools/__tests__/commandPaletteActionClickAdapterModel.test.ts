import { describe, expect, it, vi } from 'vitest';

import { buildCommandPaletteActionClickHandler } from '../commandPaletteActionClickAdapterModel';

describe('commandPaletteActionClickAdapterModel', () => {
    it('executes the clicked action and closes when the index exists', async () => {
        const executeSelected = vi.fn();
        const onRequestClose = vi.fn();

        const handleActionClick = buildCommandPaletteActionClickHandler({
            filteredActions: [
                { execute: vi.fn(), id: 'save', keywords: 'save', label: 'Save' },
                { execute: executeSelected, id: 'play', keywords: 'play', label: 'Play' },
            ],
            onRequestClose,
        });

        handleActionClick(1);
        await Promise.resolve();

        expect(executeSelected).toHaveBeenCalledTimes(1);
        expect(onRequestClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicked index is out of range', async () => {
        const onRequestClose = vi.fn();

        const handleActionClick = buildCommandPaletteActionClickHandler({
            filteredActions: [{ execute: vi.fn(), id: 'save', keywords: 'save', label: 'Save' }],
            onRequestClose,
        });

        handleActionClick(3);
        await Promise.resolve();

        expect(onRequestClose).not.toHaveBeenCalled();
    });
});


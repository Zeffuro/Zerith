import { describe, expect, it } from 'vitest';

import {
    areAllUnusedAssetsSelected,
    getSelectedUnusedAssets,
    reconcileUnusedAssetSelection,
    toggleUnusedAssetSelection,
} from '../assetDependencyPanelModel';

describe('assetDependencyPanelModel', () => {
    it('defaults a new unused asset set to selected', () => {
        expect(reconcileUnusedAssetSelection([], ['/assets/a.png', '/assets/b.png'])).toEqual([
            '/assets/a.png',
            '/assets/b.png',
        ]);
    });

    it('preserves only selected assets that are still unused', () => {
        expect(reconcileUnusedAssetSelection(['/assets/b.png', '/assets/removed.png'], [
            '/assets/a.png',
            '/assets/b.png',
        ])).toEqual(['/assets/b.png']);
    });

    it('toggles selected unused assets and reports selected cleanup targets in unused order', () => {
        const selected = toggleUnusedAssetSelection(['/assets/b.png'], '/assets/a.png', true);
        expect(selected).toEqual(['/assets/a.png', '/assets/b.png']);
        expect(areAllUnusedAssetsSelected(selected, ['/assets/a.png', '/assets/b.png'])).toBe(true);

        const nextSelected = toggleUnusedAssetSelection(selected, '/assets/a.png', false);
        expect(getSelectedUnusedAssets(nextSelected, ['/assets/a.png', '/assets/b.png'])).toEqual(['/assets/b.png']);
        expect(areAllUnusedAssetsSelected(nextSelected, ['/assets/a.png', '/assets/b.png'])).toBe(false);
    });
});

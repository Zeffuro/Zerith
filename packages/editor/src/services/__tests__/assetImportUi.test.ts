import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    importAssets: vi.fn<() => Promise<never>>(),
    log: vi.fn(),
    refreshReferences: vi.fn<() => Promise<void>>().mockResolvedValue(),
    refreshTree: vi.fn<() => Promise<void>>().mockResolvedValue(),
}));
vi.mock('../assetImport', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../assetImport')>();
    return { ...actual, importAssetsFromPicker: mocks.importAssets };
});
vi.mock('../explorerFileActions', () => ({ refreshProjectTree: mocks.refreshTree }));
vi.mock('../referenceScanner', () => ({ refreshReferenceScannerState: mocks.refreshReferences }));
vi.mock('../openProjectEntry', () => ({ openAssetEntry: vi.fn(), openProjectEntry: vi.fn() }));
vi.mock('../../store/actions/consoleMessageActions', () => ({ executeConsoleMessageAction: mocks.log }));
vi.mock('../../store/useEditorStore', () => ({ useEditorStore: { getState: vi.fn() } }));

import { handleImportAssets } from '../../components/tools/assetDependencyPanelActions';
import { AssetImportError } from '../assetImport';

describe('partial asset import UI recovery', () => {
    it('refreshes committed assets after a later copy fails', async () => {
        const entry = { assetUrl: '/assets/sprites/a.png', collisionResolved: false, kind: 'sprite' as const, sanitizedName: 'a.png', sourceIndex: 0, sourceName: 'a.png', targetFolder: 'assets/sprites', targetName: 'a.png', targetPath: '/project/assets/sprites/a.png' };
        mocks.importAssets.mockRejectedValueOnce(new AssetImportError([entry], undefined, 'Copy failed.'));
        const setImporting = vi.fn();
        await handleImportAssets('/project', setImporting);
        expect(mocks.refreshTree).toHaveBeenCalledTimes(1);
        expect(mocks.refreshReferences).toHaveBeenCalledTimes(1);
        expect(mocks.log).toHaveBeenCalledWith('editor', 'error', 'Asset import failed:', expect.stringContaining('1 asset(s) imported'));
        expect(setImporting).toHaveBeenLastCalledWith(false);
    });
});

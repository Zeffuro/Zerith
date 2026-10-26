import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AudioBufferLike } from '../../utils/audioRegions';
import type { SaveAudioRegionInput, SaveAudioRegionResult } from '../audioRegionExport';

const mocks = vi.hoisted(() => ({
    exportCues: vi.fn(),
    refreshReferences: vi.fn(),
    refreshTree: vi.fn(),
    save: vi.fn<(path: string, input: SaveAudioRegionInput, dependencies: unknown, current: () => boolean) => Promise<SaveAudioRegionResult>>(),
}));
vi.mock('../assetAudioCueExport', () => ({ exportAssetAudioCuesToProject: mocks.exportCues }));
vi.mock('../audioRegionExport', () => ({ saveAudioRegionWavToProject: mocks.save }));
vi.mock('../explorerFileActions', () => ({ refreshProjectTree: mocks.refreshTree }));
vi.mock('../referenceScanner', () => ({ refreshReferenceScannerState: mocks.refreshReferences }));

import { exportAudioCueSheets, refreshAudioExportProject, saveAudioCueBatch, saveAudioSelection } from '../audioExportActions';
import { AudioExportRetiredError } from '../audioExportOwnership';

const buffer: AudioBufferLike = { duration: 1, getChannelData: () => new Float32Array(10), length: 10, numberOfChannels: 1, sampleRate: 10 };
const result: SaveAudioRegionResult = { assetUrl: '/assets/cue.wav', collisionResolved: false, targetName: 'cue.wav', targetPath: '/A/assets/cue.wav' };
const input: SaveAudioRegionInput = { region: { end: .2, start: 0 }, sourcePath: 'source.wav', wavBytes: new Uint8Array([1]) };
function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, reject, resolve };
}

describe('audio export UI actions', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.save.mockResolvedValue(result);
        mocks.exportCues.mockResolvedValue({ exportedCount: 2 });
        mocks.refreshTree.mockImplementation(() => Promise.resolve());
        mocks.refreshReferences.mockImplementation(() => Promise.resolve());
    });

    it('keeps selection result paths and collision messages after owned refreshes', async () => {
        mocks.save.mockResolvedValueOnce({ ...result, collisionResolved: true });
        const current = vi.fn(() => true);
        await expect(saveAudioSelection('/A', input, current)).resolves.toMatchObject({ assetUrl: '/assets/cue.wav', message: 'Saved /assets/cue.wav (renamed).' });
        expect(mocks.save).toHaveBeenCalledWith('/A', input, undefined, current);
        expect(mocks.refreshTree).toHaveBeenCalledWith(current);
        expect(mocks.refreshReferences).toHaveBeenCalledWith(current);
    });

    it.each(['resolve', 'reject'] as const)('drops selection late %s before successor refreshes', async outcome => {
        let current = true;
        const pending = deferred<SaveAudioRegionResult>();
        mocks.save.mockReturnValueOnce(pending.promise);
        const run = saveAudioSelection('/A', input, () => current);
        const settled = expect(run).rejects.toThrow(outcome === 'resolve' ? AudioExportRetiredError : 'Obsolete');
        current = false;
        if (outcome === 'resolve') pending.resolve(result); else pending.reject(new Error('Obsolete'));
        await settled;
        expect(mocks.refreshTree).not.toHaveBeenCalled();
        expect(mocks.refreshReferences).not.toHaveBeenCalled();
    });

    it.each(['tree', 'scanner'] as const)('stops after retirement during %s refresh', async boundary => {
        let current = true;
        const pending = deferred<void>();
        (boundary === 'tree' ? mocks.refreshTree : mocks.refreshReferences).mockReturnValueOnce(pending.promise);
        const run = refreshAudioExportProject(() => current);
        await vi.waitFor(() => expect(boundary === 'tree' ? mocks.refreshTree : mocks.refreshReferences).toHaveBeenCalledOnce());
        const settled = expect(run).rejects.toThrow(AudioExportRetiredError);
        current = false; pending.resolve(); await settled;
        if (boundary === 'tree') expect(mocks.refreshReferences).not.toHaveBeenCalled();
    });

    it('stops an editor cue batch after its first completed write', async () => {
        let current = true;
        mocks.save.mockImplementationOnce(() => { current = false; return Promise.resolve(result); });
        await expect(saveAudioCueBatch('/A', buffer, 'source.wav', [
            { end: .2, name: 'a', start: 0 }, { end: .4, name: 'b', start: .2 },
        ], { namePreset: 'region-name-time', targetFolder: 'assets/audio-regions' }, () => current)).rejects.toThrow(AudioExportRetiredError);
        expect(mocks.save).toHaveBeenCalledOnce();
        expect(mocks.save.mock.calls[0][1].wavBytes.slice(0, 4)).toEqual(Uint8Array.from([82, 73, 70, 70]));
        expect(mocks.refreshTree).not.toHaveBeenCalled();
    });

    it('keeps editor batch defaults and success count', async () => {
        await expect(saveAudioCueBatch('/A', buffer, 'source.wav', [
            { end: .2, name: 'a', start: 0 }, { end: .4, name: 'b', start: .2 },
        ], { namePreset: 'region-name-time', targetFolder: '' }, () => true)).resolves.toEqual({ message: 'Saved 2 cue WAVs to assets/audio-regions.' });
        expect(mocks.save).toHaveBeenCalledTimes(2);
        expect(mocks.refreshReferences).toHaveBeenCalledOnce();
    });

    it.each(['resolve', 'reject'] as const)('retirement during a visible sheet %s stops following sheets and logs', async outcome => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => {});
        let current = true;
        const pending = deferred<{ exportedCount: number }>();
        mocks.exportCues.mockReturnValueOnce(pending.promise);
        const run = exportAudioCueSheets('/A', ['a.sheet.json', 'b.sheet.json'], true, () => current);
        const settled = expect(run).rejects.toThrow(AudioExportRetiredError);
        current = false;
        if (outcome === 'resolve') pending.resolve({ exportedCount: 2 }); else pending.reject(new Error('Obsolete'));
        await settled;
        expect(mocks.exportCues).toHaveBeenCalledOnce();
        expect(mocks.refreshTree).not.toHaveBeenCalled();
        expect(log).not.toHaveBeenCalled();
        log.mockRestore();
    });

    it('keeps ordinary visible-sheet failure continuation and current summary', async () => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => {});
        mocks.exportCues.mockRejectedValueOnce(new Error('Bad sheet'));
        await expect(exportAudioCueSheets('/A', ['a.sheet.json', 'b.sheet.json'], true, () => true)).resolves.toEqual({ message: 'Saved 2 cue WAVs from 1 sheet. 1 sheet failed.' });
        expect(mocks.exportCues).toHaveBeenCalledTimes(2);
        expect(mocks.refreshReferences).toHaveBeenCalledOnce();
        expect(log).toHaveBeenCalledOnce();
        log.mockRestore();
    });

    it('propagates a current single-sheet failure without refresh or continuation', async () => {
        mocks.exportCues.mockRejectedValueOnce(new Error('Permission denied'));
        await expect(exportAudioCueSheets('/A', ['a.sheet.json'], false, () => true)).rejects.toThrow('Permission denied');
        expect(mocks.refreshTree).not.toHaveBeenCalled();
        await expect(exportAudioCueSheets('/A', [], true, () => true)).resolves.toEqual({ message: 'No visible cue sheets can be exported.' });
    });
});

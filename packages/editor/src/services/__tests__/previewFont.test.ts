import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ clearMetrics: vi.fn(), release: vi.fn(), resolve: vi.fn<(url: string, root: string) => Promise<string>>() }));
vi.mock('pixi.js', () => ({ CanvasTextMetrics: { clearMetrics: mocks.clearMetrics } }));
vi.mock('../runtime/assetUrls', () => ({ releaseEditorAssetUrl: mocks.release, resolveProjectAssetUrl: mocks.resolve }));

import { createPreviewFontOwner } from '../previewFont';

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, reject, resolve };
}

describe('preview font ownership', () => {
    const fonts = new Set<FontFace>();
    const load = vi.fn<(face: FontFace) => Promise<FontFace>>();
    const constructed: { face: FontFace; family: string; source: string }[] = [];
    let current = true;

    beforeEach(() => {
        vi.resetAllMocks();
        fonts.clear();
        constructed.length = 0;
        current = true;
        vi.stubGlobal('document', { fonts });
        vi.stubGlobal('FontFace', class {
            constructor(family: string, source: string) {
                constructed.push({ face: this as unknown as FontFace, family, source });
            }
            load() { return load(this as unknown as FontFace); }
        });
        load.mockImplementation(face => Promise.resolve(face));
        mocks.resolve.mockImplementation((url, root) => Promise.resolve(`data:${root}${url}`));
    });
    afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

    it('resolves each project despite matching family and relative path, and removes only owned faces', async () => {
        const foreignFace = {} as FontFace;
        fonts.add(foreignFace);
        const first = createPreviewFontOwner('/A', () => current);
        await first.load('Shared', '/font.ttf');
        expect(fonts.size).toBe(2);
        expect(mocks.clearMetrics).toHaveBeenCalledTimes(1);
        first.dispose();
        first.dispose();
        expect([...fonts]).toEqual([foreignFace]);
        expect(mocks.clearMetrics).toHaveBeenCalledTimes(2);
        const second = createPreviewFontOwner('/B', () => current);
        await second.load('Shared', '/font.ttf');
        expect(constructed.map(({ source }) => source)).toEqual(['url("data:/A/font.ttf")', 'url("data:/B/font.ttf")']);
        expect(mocks.release.mock.calls).toEqual([['data:/A/font.ttf'], ['data:/B/font.ttf']]);
        second.dispose();
        expect([...fonts]).toEqual([foreignFace]);
        expect(mocks.clearMetrics).toHaveBeenCalledTimes(4);
    });

    it('reloads the same project after disposal', async () => {
        const first = createPreviewFontOwner('/A', () => current);
        await first.load('Shared', '/font.ttf');
        first.dispose();
        const second = createPreviewFontOwner('/A', () => current);
        await second.load('Shared', '/font.ttf');
        expect(mocks.resolve).toHaveBeenCalledTimes(2);
        expect([...fonts]).toEqual([constructed[1].face]);
        second.dispose();
    });

    it.each(['dispose', 'session'] as const)('rejects URL resolution after %s without constructing a face', async mode => {
        const pending = deferred<string>();
        mocks.resolve.mockReturnValue(pending.promise);
        const owner = createPreviewFontOwner('/A', () => current);
        const loading = owner.load('Shared', '/font.ttf');
        if (mode === 'dispose') owner.dispose();
        else current = false;
        pending.resolve('blob:stale');
        await loading;
        expect(constructed).toEqual([]);
        expect(mocks.release).toHaveBeenCalledExactlyOnceWith('blob:stale');
        expect(fonts.size).toBe(0);
    });

    it.each(['dispose', 'session'] as const)('rejects loaded faces after %s while retaining the new owner', async mode => {
        const pending = deferred<FontFace>();
        load.mockReturnValueOnce(pending.promise);
        const owner = createPreviewFontOwner('/A', () => current);
        const loading = owner.load('Shared', '/font.ttf');
        await vi.waitFor(() => expect(constructed).toHaveLength(1));
        if (mode === 'dispose') owner.dispose();
        else current = false;
        const next = createPreviewFontOwner('/B', () => true);
        await next.load('Shared', '/font.ttf');
        pending.resolve(constructed[0].face);
        await loading;
        expect([...fonts]).toEqual([constructed[1].face]);
        expect(mocks.release).toHaveBeenCalledTimes(2);
        next.dispose();
    });

    it.each(['resolve', 'load'] as const)('reports current %s failure and releases acquired URLs before retry', async phase => {
        const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
        if (phase === 'resolve') mocks.resolve.mockRejectedValueOnce(new Error('read failed'));
        else load.mockRejectedValueOnce(new Error('bad font'));
        const owner = createPreviewFontOwner('/A', () => current);
        await owner.load('Shared', '/font.ttf');
        expect(warning).toHaveBeenCalledOnce();
        expect(fonts.size).toBe(0);
        expect(mocks.release).toHaveBeenCalledTimes(phase === 'load' ? 1 : 0);
        await owner.load('Shared', '/font.ttf');
        expect(fonts.size).toBe(1);
        owner.dispose();
    });

    it.each(['resolve', 'load'] as const)('silences stale %s failure without retaining faces', async phase => {
        const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const pending = deferred<never>();
        if (phase === 'resolve') mocks.resolve.mockReturnValue(pending.promise);
        else load.mockReturnValue(pending.promise);
        const owner = createPreviewFontOwner('/A', () => current);
        const loading = owner.load('Shared', '/font.ttf');
        if (phase === 'load') await vi.waitFor(() => expect(constructed).toHaveLength(1));
        owner.dispose();
        pending.reject(new Error('stale failure'));
        await loading;
        expect(warning).not.toHaveBeenCalled();
        expect(fonts.size).toBe(0);
        expect(mocks.release).toHaveBeenCalledTimes(phase === 'load' ? 1 : 0);
    });

    it('skips unavailable APIs, blank paths and disposed owners', async () => {
        const owner = createPreviewFontOwner('/A', () => current);
        await owner.load('Shared', ' ');
        owner.dispose();
        await owner.load('Shared', '/font.ttf');
        vi.stubGlobal('FontFace', globalThis.undefined);
        await createPreviewFontOwner('/A', () => current).load('Shared', '/font.ttf');
        vi.stubGlobal('document', globalThis.undefined);
        await createPreviewFontOwner('/A', () => current).load('Shared', '/font.ttf');
        expect(mocks.resolve).not.toHaveBeenCalled();
    });
});

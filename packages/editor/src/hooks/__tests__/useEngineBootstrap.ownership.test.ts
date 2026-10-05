import type { Engine } from '@zeffuro/zerith-core';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    bootstrap: vi.fn<() => Promise<Engine>>(),
    config: vi.fn<() => Promise<string>>(),
    effect: undefined as (() => (() => void) | undefined) | undefined,
    fontLoad: vi.fn<(face: FontFace) => Promise<FontFace>>(),
    generation: 1,
    path: '/A',
    release: vi.fn(),
    resolve: vi.fn<() => Promise<string>>(),
    resolvers: [] as { dispose: ReturnType<typeof vi.fn>; resolve: ReturnType<typeof vi.fn> }[],
    setEngine: vi.fn(),
}));
vi.mock('react', () => ({ useEffect: (effect: () => () => void) => { mocks.effect = effect; }, useRef: (value: unknown) => ({ current: value }) }));
vi.mock('pixi.js', () => ({ CanvasTextMetrics: { clearMetrics: vi.fn() } }));
vi.mock('@zeffuro/zerith-core', () => ({ bootstrapEngine: mocks.bootstrap, EngineConfigSchema: { safeParse: (data: unknown) => ({ data, success: true }) } }));
vi.mock('../../services/fs', () => ({ fsJoin: (...parts: string[]) => Promise.resolve(parts.join('/')), fsReadTextFile: mocks.config }));
vi.mock('../../services/gamePreviewLoggerBridge', () => ({ createGamePreviewLogger: vi.fn() }));
vi.mock('../../services/previewSceneNavigation', () => ({ createPreviewSceneNavigationHandler: vi.fn() }));
vi.mock('../../services/runtime/assetUrls', () => ({
    createProjectAssetResolver: () => {
        const resolver = { dispose: vi.fn(), resolve: vi.fn() };
        mocks.resolvers.push(resolver);
        return resolver;
    },
    releaseEditorAssetUrl: mocks.release, resolveProjectAssetUrl: mocks.resolve,
}));
function projectState() { return { projectGeneration: mocks.generation, projectPath: mocks.path }; }
vi.mock('../../store/storeBootstrap', () => {
    return { useProjectStore: Object.assign((selector: (value: ReturnType<typeof projectState>) => unknown) => selector(projectState()), { getState: projectState }) };
});
vi.mock('../../store/useEditorStore', () => ({ useEditorStore: { getState: () => ({ clearActiveExecutionPath: vi.fn(), playTrigger: 0, setPlaybackPaused: vi.fn(), stopTrigger: 0 }) } }));
vi.mock('../../store/useEngineBridgeStore', () => ({ useEngineBridgeStore: { getState: () => ({ setEngine: mocks.setEngine }) } }));
vi.mock('../../store/usePlaytestStore', () => ({ usePlaytestStore: { getState: () => ({ request: undefined }) } }));
vi.mock('../../store/useSettingsStore', () => ({ useSettingsStore: { getState: () => ({ isMuted: false }) } }));
vi.mock('../useDebugBridge', () => ({ useDebugBridge: () => ({ attachDebugBridge: vi.fn() }) }));
vi.mock('../usePlaybackControl', () => ({ startPreviewPlayback: vi.fn() }));

import { useEngineBootstrap } from '../useEngineBootstrap';

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, reject, resolve };
}
function engine() {
    return { destroy: vi.fn(), scenes: { addScene: vi.fn(), jumpToScene: vi.fn() }, setInputEnabled: vi.fn(), stateManager: { setPersistent: vi.fn() } };
}
function PreviewBootstrap() {
    useEngineBootstrap({
        activeFileReference: { current: undefined }, canvasReference: { current: {} as HTMLCanvasElement },
        containerReference: { current: {} as HTMLDivElement }, localizationReloadKey: '', manifest: {},
        playbackRequestIdReference: { current: 0 }, projectDataReference: { current: { characters: {}, items: {}, macros: {}, scenes: {} } },
        projectPath: mocks.path, reloadToken: 0, scriptReference: { current: [] }, setPreviewLogCaptureEnabled: vi.fn(),
    });
    const cleanup = mocks.effect?.();
    if (!cleanup) throw new Error('Effect cleanup missing');
    return cleanup;
}

describe('preview bootstrap lifetime', () => {
    const fonts = new Set<FontFace>();
    const faces: FontFace[] = [];
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.path = '/A'; mocks.generation = 1;
        mocks.resolvers.length = 0; fonts.clear(); faces.length = 0;
        vi.stubGlobal('document', { fonts });
        vi.stubGlobal('FontFace', class {
            constructor() { faces.push(this as unknown as FontFace); }
            load() { return mocks.fontLoad(this as unknown as FontFace); }
        });
        mocks.config.mockResolvedValue(JSON.stringify({ preview: { fontAssetUrl: '/font.ttf' }, theme: { fontFamily: 'Shared' } }));
        mocks.resolve.mockResolvedValue('data:font');
        mocks.fontLoad.mockImplementation(face => Promise.resolve(face));
        mocks.bootstrap.mockImplementation(() => Promise.resolve(engine() as unknown as Engine));
    });
    afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

    it.each(['config', 'resolve', 'load'] as const)('blocks stale %s completion after A to B to A before effect cleanup', async phase => {
        const pending = deferred<never>();
        if (phase === 'config') mocks.config.mockReturnValueOnce(pending.promise);
        if (phase === 'resolve') mocks.resolve.mockReturnValueOnce(pending.promise);
        if (phase === 'load') mocks.fontLoad.mockReturnValueOnce(pending.promise);
        const cleanup = PreviewBootstrap();
        if (phase === 'resolve') await vi.waitFor(() => expect(mocks.resolve).toHaveBeenCalledOnce());
        if (phase === 'load') await vi.waitFor(() => expect(faces).toHaveLength(1));
        mocks.path = '/B'; mocks.generation++;
        mocks.path = '/A'; mocks.generation++;
        // The old effect has not cleaned up, but its captured generation is already stale.
        pending.resolve((phase === 'config' ? '{}' : (phase === 'resolve' ? 'data:stale' : faces[0])) as never);
        await new Promise(resolve => setTimeout(resolve, 0));
        await vi.waitFor(() => {
            if (phase !== 'config') expect(mocks.release).toHaveBeenCalledOnce();
            expect(mocks.bootstrap).not.toHaveBeenCalled();
        });
        expect(fonts.size).toBe(0);
        cleanup();
    });

    it.each(['resolve', 'load'] as const)('cleanup during pending %s allows only the replacement to publish', async phase => {
        const pending = deferred<never>();
        if (phase === 'resolve') mocks.resolve.mockReturnValueOnce(pending.promise);
        else mocks.fontLoad.mockReturnValueOnce(pending.promise);
        const oldCleanup = PreviewBootstrap();
        await vi.waitFor(() => expect(phase === 'resolve' ? mocks.resolve.mock.calls.length : faces.length).toBe(1));
        oldCleanup();
        const nextCleanup = PreviewBootstrap();
        await vi.waitFor(() => expect(mocks.setEngine).toHaveBeenCalledWith(expect.any(Object)));
        const newFaces = [...fonts];
        pending.resolve((phase === 'resolve' ? 'data:old' : faces[0]) as never);
        await vi.waitFor(() => expect(mocks.release).toHaveBeenCalledTimes(2));
        expect([...fonts]).toEqual(newFaces);
        expect(mocks.bootstrap).toHaveBeenCalledOnce();
        nextCleanup();
        expect(fonts.size).toBe(0);
    });

    it.each(['success', 'failure'] as const)('settles old bootstrap %s without disposing the replacement owner', async outcome => {
        const pending = deferred<Engine>();
        mocks.bootstrap.mockReturnValueOnce(pending.promise);
        const cleanup = PreviewBootstrap();
        await vi.waitFor(() => expect(mocks.bootstrap).toHaveBeenCalledOnce());
        cleanup();
        const nextCleanup = PreviewBootstrap();
        await vi.waitFor(() => expect(mocks.bootstrap).toHaveBeenCalledTimes(2));
        await vi.waitFor(() => expect(mocks.setEngine).toHaveBeenCalledWith(expect.any(Object)));
        const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const oldEngine = engine();
        if (outcome === 'success') pending.resolve(oldEngine as unknown as Engine);
        else pending.reject(new Error('old bootstrap failed'));
        await vi.waitFor(() => expect(mocks.resolvers[0].dispose).toHaveBeenCalledTimes(2));
        expect(mocks.resolvers[1].dispose).not.toHaveBeenCalled();
        expect(fonts.size).toBe(1);
        expect(warning).not.toHaveBeenCalled();
        if (outcome === 'success') expect(oldEngine.destroy).toHaveBeenCalledOnce();
        nextCleanup();
    });

    it('disposes the current font and resolver on bootstrap failure', async () => {
        mocks.bootstrap.mockRejectedValue(new Error('current bootstrap failed'));
        const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const cleanup = PreviewBootstrap();
        await vi.waitFor(() => expect(warning).toHaveBeenCalledOnce());
        expect(fonts.size).toBe(0);
        expect(mocks.resolvers[0].dispose).toHaveBeenCalledOnce();
        cleanup();
    });
});

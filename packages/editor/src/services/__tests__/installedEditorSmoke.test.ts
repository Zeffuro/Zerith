import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ExportGameResult } from '../exportGame';
import type { InstalledSmokeConfig, InstalledSmokeResult } from '../installedEditorSmoke';

type ProjectSession = {
    manifest?: { title?: string };
    markFileDirty: (path: string) => void;
    openProjectFromManifest: (path: string) => Promise<boolean>;
    projectPath?: string;
    saveAllDirtyFiles: () => Promise<{ failed: string[]; saved: string[]; skipped: string[] }>;
    setProject: (path: undefined, files: []) => void;
};

type WorkbenchSession = {
    clearTabs: () => void;
    openOrFocusTab: (tab: { id: string; kind: string; path: string; textContent: string; title: string }) => void;
    updateTabContent: (id: string, text: string) => void;
};

const mocks = vi.hoisted(() => ({
    create: vi.fn<() => Promise<void>>(),
    export: vi.fn<(path: string, options: { outDir: string; zip: boolean; zipFile: string }) => Promise<ExportGameResult>>(),
    getProject: vi.fn<() => ProjectSession>(),
    getWorkbench: vi.fn<() => WorkbenchSession>(),
    invoke: vi.fn<(command: string, payload: { result: InstalledSmokeResult }) => Promise<void>>(),
    join: vi.fn<(parent: string, child: string) => Promise<string>>(),
    read: vi.fn<(path: string) => Promise<string>>(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));
vi.mock('../../store/storeBootstrap', () => ({ useProjectStore: { getState: mocks.getProject } }));
vi.mock('../../store/useWorkbenchStore', () => ({
    makeTabId: (kind: string, path: string) => `${kind}:${path}`,
    useWorkbenchStore: { getState: mocks.getWorkbench },
}));
vi.mock('../createNewProject', () => ({ createNewProject: mocks.create }));
vi.mock('../exportGame', () => ({ exportGame: mocks.export }));
vi.mock('../fs', () => ({ fsJoin: mocks.join, fsReadTextFile: mocks.read }));
vi.mock('../runtime/runtimeEnvironment', () => ({ isTauriRuntime: () => true }));

import { runInstalledEditorSmoke } from '../installedEditorSmoke';

function completion(): InstalledSmokeResult {
    expect(mocks.invoke).toHaveBeenCalledOnce();
    expect(mocks.invoke.mock.calls[0]?.[0]).toBe('installed_smoke_complete');
    const result = mocks.invoke.mock.calls[0]?.[1].result;
    expect(result).toBeDefined();
    return result;
}

function fixture(requested: string, options: {
    existing?: boolean;
    missingManifest?: 'open' | 'reopen';
    openPaths?: (string | undefined)[];
    rejectReopen?: boolean;
    staleReopenTitle?: boolean;
} = {}) {
    const config: InstalledSmokeConfig = {
        existingProjectPath: options.existing ? requested : undefined,
        outDir: 'exports/web',
        parentPath: String.raw`F:\Projects`,
        projectName: 'Smoke Game',
        zipFile: 'exports/web.zip',
    };
    const manifestPath = `${requested.replace(/[\\/]$/u, '')}/game.json`;
    const originalText = JSON.stringify({ title: 'Original game' });
    const files = new Map<string, string>();
    if (options.existing) files.set(manifestPath, originalText);
    let projectPath: string | undefined;
    let manifest: { title?: string } | undefined;
    let editedText = '';
    let opened = 0;
    const open = vi.fn<(path: string) => Promise<boolean>>(path => {
        expect(path).toBe(manifestPath);
        opened += 1;
        if (opened === 2 && options.rejectReopen) return Promise.resolve(false);
        projectPath = options.openPaths ? options.openPaths[opened - 1] : requested;
        manifest = JSON.parse(files.get(path) ?? '{}') as { title?: string };
        if (options.missingManifest === (opened === 1 ? 'open' : 'reopen')) manifest = undefined;
        if (opened === 2 && options.staleReopenTitle) manifest = { title: 'Original game' };
        return Promise.resolve(true);
    });
    const dirty = vi.fn<(path: string) => void>();
    const save = vi.fn(() => {
        files.set(manifestPath, editedText);
        return Promise.resolve({ failed: [], saved: [manifestPath], skipped: [] });
    });
    const close = vi.fn(() => { projectPath = undefined; manifest = undefined; });
    const clearTabs = vi.fn();
    const openTab = vi.fn<WorkbenchSession['openOrFocusTab']>();
    const updateTab = vi.fn<WorkbenchSession['updateTabContent']>((_id, text) => { editedText = text; });
    mocks.getProject.mockImplementation(() => ({ manifest, markFileDirty: dirty, openProjectFromManifest: open, projectPath, saveAllDirtyFiles: save, setProject: close }));
    mocks.getWorkbench.mockReturnValue({ clearTabs, openOrFocusTab: openTab, updateTabContent: updateTab });
    mocks.join.mockImplementation((parent, child) => {
        if (parent === config.parentPath && child === config.projectName) return Promise.resolve(requested);
        expect([parent, child]).toEqual([requested, 'game.json']);
        return Promise.resolve(manifestPath);
    });
    mocks.read.mockImplementation(path => Promise.resolve(files.get(path) ?? ''));
    mocks.create.mockImplementation(() => { files.set(manifestPath, originalText); return Promise.resolve(); });
    mocks.invoke.mockResolvedValue();
    const exported: ExportGameResult = {
        artifactManifest: { files: ['index.html', 'game.json', 'zerith.content.json'] },
        outDirectory: `${requested}/exports/web`,
        stderr: '',
        stdout: 'Built game',
        zipPath: `${requested}/exports/web.zip`,
    };
    mocks.export.mockResolvedValueOnce(exported).mockRejectedValueOnce(new Error('Output already exists'));
    return {
        clearTabs,
        close,
        config,
        dirty,
        exported,
        files,
        manifestPath,
        open,
        openTab,
        save,
        updateTab,
    };
}

describe('installed editor smoke project identity', () => {
    beforeEach(() => { vi.resetAllMocks(); });

    it.each([
        [String.raw`F:\Projects\Smoke Game`, 'F:/Projects/Smoke Game'],
        [String.raw`F:\Projects\Smoke Game`, 'f:/projects/smoke game/'],
        [String.raw`F:\Smoke Game`, 'f:/SMOKE GAME'],
        [String.raw`\\SERVER\Share\Smoke Game`, '//server/share/smoke game'],
    ])('completes create/save/reopen/export for native path aliases: %s -> %s', async (requested, loaded) => {
        const session = fixture(requested, { openPaths: [loaded, loaded] });
        await runInstalledEditorSmoke(session.config);

        expect(completion()).toMatchObject({
            artifactManifest: session.exported.artifactManifest,
            editedTitle: 'Smoke Game — saved and reopened',
            outDirectory: session.exported.outDirectory,
            projectPath: requested,
            status: 'passed',
            steps: ['create', 'open', 'edit', 'save', 'reopen', 'export', 'overwrite-guard'],
            zipPath: session.exported.zipPath,
        });
        expect(mocks.create).toHaveBeenCalledWith({ author: 'Installed smoke', directory: requested, name: 'Smoke Game', templateId: 'classic-vn' });
        expect(session.open.mock.calls).toEqual([[session.manifestPath], [session.manifestPath]]);
        expect(session.dirty).toHaveBeenCalledWith(session.manifestPath);
        expect(session.save).toHaveBeenCalledOnce();
        expect(session.close).toHaveBeenCalledWith(undefined, []);
        expect(session.clearTabs).toHaveBeenCalledOnce();
        expect(session.openTab).toHaveBeenCalledWith(expect.objectContaining({ path: session.manifestPath, textContent: '{"title":"Original game"}' }));
        expect(session.updateTab).toHaveBeenCalledOnce();
        expect(JSON.parse(session.files.get(session.manifestPath) ?? '{}')).toEqual({ title: 'Smoke Game — saved and reopened' });
        expect(mocks.export.mock.calls).toEqual(Array.from({ length: 2 }, () => [requested, { outDir: session.config.outDir, zip: true, zipFile: session.config.zipFile }]));
    });

    it.each([['F:\\', 'f:/'], ['f:/', 'F:\\']])('reopens an existing drive-root project: %s', async (requested, loaded) => {
        const session = fixture(requested, { existing: true, openPaths: [loaded, loaded] });
        await runInstalledEditorSmoke(session.config);
        expect(completion()).toMatchObject({ status: 'passed', steps: ['open', 'edit', 'save', 'reopen', 'export', 'overwrite-guard'] });
        expect(mocks.create).not.toHaveBeenCalled();
        expect(session.open).toHaveBeenCalledTimes(2);
        expect(mocks.export).toHaveBeenCalledTimes(2);
    });

    it.each([
        [String.raw`F:\Projects\Smoke Game`, 'F:/Projects/Other Game'],
        [String.raw`F:\Projects\Smoke Game`, 'G:/Projects/Smoke Game'],
        ['/games/Smoke Game', '/games/smoke game'],
        ['F:\\', 'F:'],
        [String.raw`F:\Projects\Smoke Game`, undefined],
    ])('rejects a different or missing project root: %s -> %s', async (requested, loaded) => {
        const session = fixture(requested, { openPaths: [loaded] });
        await runInstalledEditorSmoke(session.config);
        expect(completion()).toMatchObject({ error: 'Project did not load into the editor store.', status: 'failed', steps: ['create'] });
        expect(session.save).not.toHaveBeenCalled();
        expect(mocks.export).not.toHaveBeenCalled();
    });

    it.each(['open', 'reopen'] as const)('rejects a missing manifest after %s', async phase => {
        const requested = String.raw`F:\Projects\Smoke Game`;
        const session = fixture(requested, { missingManifest: phase, openPaths: ['F:/Projects/Smoke Game', 'F:/Projects/Smoke Game'] });
        await runInstalledEditorSmoke(session.config);
        expect(completion()).toMatchObject({ error: 'Project did not load into the editor store.', status: 'failed', steps: phase === 'open' ? ['create'] : ['create', 'open', 'edit', 'save'] });
        expect(mocks.export).not.toHaveBeenCalled();
    });

    it.each([
        { openPaths: ['F:/Projects/Smoke Game', 'F:/Projects/Other Game'] },
        { openPaths: ['F:/Projects/Smoke Game', undefined] },
        { rejectReopen: true },
    ])('rejects a reopen that lost the requested project: %j', async options => {
        const session = fixture(String.raw`F:\Projects\Smoke Game`, options);
        await runInstalledEditorSmoke(session.config);
        expect(completion()).toMatchObject({ error: 'Project did not load into the editor store.', status: 'failed', steps: ['create', 'open', 'edit', 'save'] });
        expect(session.save).toHaveBeenCalledOnce();
        expect(session.open).toHaveBeenCalledTimes(2);
        expect(mocks.export).not.toHaveBeenCalled();
    });

    it('rejects stale reopened content even when the native project path matches', async () => {
        const session = fixture(String.raw`F:\Projects\Smoke Game`, { openPaths: ['f:/projects/smoke game', 'F:/Projects/Smoke Game'], staleReopenTitle: true });
        await runInstalledEditorSmoke(session.config);
        expect(completion()).toMatchObject({ error: 'Reopened project did not contain the saved edit.', status: 'failed', steps: ['create', 'open', 'edit', 'save'] });
        expect(JSON.parse(session.files.get(session.manifestPath) ?? '{}')).toEqual({ title: 'Smoke Game — saved and reopened' });
        expect(mocks.export).not.toHaveBeenCalled();
    });
});

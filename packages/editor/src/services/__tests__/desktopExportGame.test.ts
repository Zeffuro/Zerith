import { beforeEach, describe, expect, it, vi } from 'vitest';

import { exportGame } from '../exportGame';

const mocks = vi.hoisted(() => ({
    invoke: vi.fn(),
    native: true,
    prepare: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));
vi.mock('../runtime/runtimeEnvironment', () => ({ isTauriRuntime: () => mocks.native }));
vi.mock('../webGameArtifacts', () => ({ prepareWebGameArtifacts: mocks.prepare }));

describe('desktop game export', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.native = true;
        mocks.prepare.mockResolvedValue({
            artifactManifest: { version: 1 },
            files: { 'index.html': new Uint8Array([1, 2, 3]) },
            nativeFiles: [{ path: 'game.json', sourcePath: '/project/game.json' }],
        });
        mocks.invoke.mockResolvedValue({ executablePath: '/output/game-player.exe', outDirectory: '/output', stderr: '', stdout: 'Desktop game built' });
    });

    it('uses the dedicated game packager with compiled web content and native project sources', async () => {
        const result = await exportGame('/project', { base: '/old-base/', outDir: '/output', profile: 'desktop-tauri', zip: true, zipFile: '/old.zip' });
        expect(mocks.invoke).toHaveBeenCalledWith('export_desktop_game', {
            request: {
                base: './',
                cachePolicy: 'hashed',
                files: [{ bytes: [1, 2, 3], path: 'index.html' }, { path: 'game.json', sourcePath: '/project/game.json' }],
                gamePath: '/project',
                outDir: '/output',
                zip: false,
                zipFile: undefined,
            },
        });
        expect(result.executablePath).toBe('/output/game-player.exe');
    });

    it('rejects desktop packaging in the browser before preparing or writing artifacts', async () => {
        mocks.native = false;
        await expect(exportGame('/project', { profile: 'desktop-tauri' })).rejects.toThrow('desktop editor');
        expect(mocks.prepare).not.toHaveBeenCalled();
        expect(mocks.invoke).not.toHaveBeenCalled();
    });

    it('keeps native web exports on the web artifact command', async () => {
        await exportGame('/project', { profile: 'generic-web' });
        expect(mocks.invoke.mock.calls[0]?.[0]).toBe('export_game');
    });

    it.each(['generic-web', 'desktop-tauri'] as const)('does not dispatch retired %s preparation', async profile => {
        let finish!: (value: unknown) => void;
        const artifacts: unknown = await mocks.prepare();
        mocks.prepare.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
        let current = true;
        const pending = exportGame('/project', { profile }, () => current);
        await vi.waitFor(() => expect(mocks.prepare).toHaveBeenCalledTimes(2));
        current = false;
        finish(artifacts);
        await expect(pending).rejects.toThrow('cancelled');
        expect(mocks.invoke).not.toHaveBeenCalled();
    });

    it.each(['generic-web', 'desktop-tauri'] as const)('drops a retired %s result after native dispatch', async profile => {
        let finish!: (value: unknown) => void;
        mocks.invoke.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
        let current = true;
        const pending = exportGame('/project', { profile }, () => current);
        await vi.waitFor(() => expect(mocks.invoke).toHaveBeenCalledOnce());
        current = false;
        finish({ stderr: '', stdout: 'Old output' });
        await expect(pending).rejects.toThrow('cancelled');
        expect(mocks.invoke).toHaveBeenCalledOnce();
    });

    it('does not prepare an already retired request', async () => {
        await expect(exportGame('/project', {}, () => false)).rejects.toThrow('cancelled');
        expect(mocks.prepare).not.toHaveBeenCalled();
        expect(mocks.invoke).not.toHaveBeenCalled();
    });
});

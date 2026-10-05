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
});

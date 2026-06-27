import { describe, expect, it, vi } from 'vitest';

import type { ExportGameResult } from '../exportGame';

import { runBrowserDesktopExportSmoke } from '../exportParityRunner';

describe('exportParityRunner', () => {
    it('runs browser export without downloads and compares desktop artifacts', async () => {
        const browserResult = createExportResult('browser', ['index.html', 'zerith.content.json', 'zerith-player/index.js', 'game.json']);
        const desktopResult = createExportResult('desktop', ['index.html', 'zerith.content.json', 'assets/index.js', 'game.json']);
        const runBrowserExport = vi.fn(() => Promise.resolve(browserResult));
        const runDesktopExport = vi.fn(() => Promise.resolve(desktopResult));

        const report = await runBrowserDesktopExportSmoke('/game', {
            cachePolicy: 'hashed',
            outDir: 'dist/game',
        }, {
            runBrowserExport,
            runDesktopExport,
        });

        expect(runBrowserExport).toHaveBeenCalledWith('/game', expect.objectContaining({
            download: false,
            profile: 'local-preview',
        }));
        expect(runDesktopExport).toHaveBeenCalledWith('/game', expect.objectContaining({
            outDir: 'dist/game',
            profile: 'local-preview',
        }));
        expect(report.comparison).toMatchObject({
            artifactComparison: {
                summary: {
                    matched: 4,
                    mismatched: 0,
                    missing: 0,
                },
            },
            status: 'matched',
        });
    });

    it('reports blocked comparisons when an export result lacks artifacts', async () => {
        const report = await runBrowserDesktopExportSmoke('/game', {}, {
            runBrowserExport: () => Promise.resolve({ stderr: '', stdout: 'browser' }),
            runDesktopExport: () => Promise.resolve(createExportResult('desktop', ['index.html'])),
        });

        expect(report.comparison).toEqual({
            browserStdout: 'browser',
            desktopStdout: 'desktop',
            reasons: ['Browser export result did not include an artifact manifest.'],
            status: 'blocked',
        });
    });
});

function createExportResult(stdout: string, files: string[]): ExportGameResult {
    return {
        artifactManifest: {
            fileHashes: { 'zerith.content.json': 'same-hash' },
            files,
            projectFiles: ['game.json'],
        },
        stderr: '',
        stdout,
    };
}

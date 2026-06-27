import { describe, expect, it } from 'vitest';

import { compareBrowserDesktopExportRuns } from '../exportParitySmoke';

describe('exportParitySmoke', () => {
    it('matches browser and desktop export results with compatible artifact manifests', () => {
        const comparison = compareBrowserDesktopExportRuns({
            artifactManifest: {
                fileHashes: { 'zerith.content.json': 'abc123' },
                files: [
                    'index.html',
                    'zerith.content.json',
                    'zerith-player/index.js',
                    'game.json',
                ],
                projectFiles: ['game.json'],
            },
            stderr: '',
            stdout: 'browser export',
        }, {
            artifactManifest: {
                fileHashes: { 'zerith.content.json': 'abc123' },
                files: [
                    'index.html',
                    'zerith.content.json',
                    'assets/index.js',
                    'game.json',
                ],
                projectFiles: ['game.json'],
            },
            stderr: '',
            stdout: 'desktop export',
        });

        expect(comparison).toMatchObject({
            artifactComparison: {
                summary: {
                    matched: 4,
                    mismatched: 0,
                    missing: 0,
                },
            },
            browserStdout: 'browser export',
            desktopStdout: 'desktop export',
            status: 'matched',
        });
    });

    it('reports mismatched artifact comparisons from export results', () => {
        const comparison = compareBrowserDesktopExportRuns({
            artifactManifest: {
                fileHashes: { 'zerith.content.json': 'browser' },
                files: [
                    'index.html',
                    'zerith.content.json',
                    'game.json',
                ],
                projectFiles: ['game.json', 'scenes/intro.json'],
            },
            stderr: '',
            stdout: 'browser export',
        }, {
            artifactManifest: {
                fileHashes: { 'zerith.content.json': 'desktop' },
                files: [
                    'index.html',
                    'zerith.content.json',
                    'assets/index.js',
                    'game.json',
                    'scenes/intro.json',
                ],
                projectFiles: ['game.json', 'scenes/intro.json'],
            },
            stderr: '',
            stdout: 'desktop export',
        });

        expect(comparison).toMatchObject({
            artifactComparison: {
                summary: {
                    matched: 1,
                    mismatched: 1,
                    missing: 2,
                },
            },
            status: 'mismatched',
        });
    });

    it('blocks comparison until both export results include artifact manifests', () => {
        expect(compareBrowserDesktopExportRuns({
            stderr: '',
            stdout: 'browser export',
        }, {
            stderr: '',
            stdout: 'desktop export',
        })).toEqual({
            browserStdout: 'browser export',
            desktopStdout: 'desktop export',
            reasons: [
                'Browser export result did not include an artifact manifest.',
                'Desktop export result did not include an artifact manifest.',
            ],
            status: 'blocked',
        });
    });
});

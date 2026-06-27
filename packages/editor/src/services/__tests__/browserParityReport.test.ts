import { describe, expect, it } from 'vitest';

import {
    compareBrowserDesktopExportArtifacts,
    createBrowserDesktopExportArtifactManifest,
    createBrowserParityReport,
} from '../browserParityReport';

describe('browserParityReport', () => {
    it('reports desktop editor capabilities as supported', () => {
        const report = createBrowserParityReport({
            browserFileSystemAccess: false,
            runtime: 'desktop',
        });

        expect(report.summary).toEqual({
            limited: 0,
            supported: 5,
            unsupported: 0,
        });
        expect(report.exportComparison.summary).toEqual({
            'browser-limited': 3,
            'desktop-only': 1,
            matched: 3,
        });
    });

    it('reports browser editor parity limits with File System Access support', () => {
        const report = createBrowserParityReport({
            browserFileSystemAccess: true,
            runtime: 'browser',
        });

        expect(report.summary).toEqual({
            limited: 3,
            supported: 1,
            unsupported: 1,
        });
        expect(report.capabilities.find((capability) => capability.id === 'projectFileSystem')).toMatchObject({
            browser: 'limited',
            desktop: 'supported',
        });
        expect(report.capabilities.find((capability) => capability.id === 'revealInFileManager')).toMatchObject({
            browser: 'unsupported',
            desktop: 'supported',
        });
        expect(report.exportComparison.features.find((feature) => feature.id === 'compiledContent')).toMatchObject({
            status: 'matched',
        });
        expect(report.exportComparison.features.find((feature) => feature.id === 'zipArchive')).toMatchObject({
            status: 'browser-limited',
        });
        expect(report.exportComparison.features.find((feature) => feature.id === 'looseOutput')).toMatchObject({
            status: 'desktop-only',
        });
    });

    it('reports unsupported project filesystem when the browser lacks picker APIs', () => {
        expect(createBrowserParityReport({
            browserFileSystemAccess: false,
            runtime: 'browser',
        }).capabilities.find((capability) => capability.id === 'projectFileSystem')).toMatchObject({
            browser: 'unsupported',
        });
    });

    it('compares browser zip and desktop export artifact manifests', () => {
        const comparison = compareBrowserDesktopExportArtifacts({
            fileHashes: { 'zerith.content.json': 'abc123' },
            files: [
                'index.html',
                'zerith.content.json',
                'zerith-player/index.js',
                'game.json',
                'scenes/intro.json',
            ],
            projectFiles: ['game.json', 'scenes/intro.json'],
        }, {
            fileHashes: { 'zerith.content.json': 'abc123' },
            files: [
                'index.html',
                'zerith.content.json',
                'assets/index.js',
                'game.json',
                'scenes/intro.json',
            ],
            projectFiles: ['game.json', 'scenes/intro.json'],
        });

        expect(comparison.summary).toEqual({
            matched: 4,
            mismatched: 0,
            missing: 0,
        });
        expect(comparison.checks.find((check) => check.id === 'compiledContent')).toMatchObject({
            status: 'matched',
        });
    });

    it('creates normalized artifact manifests from export file lists', () => {
        expect(createBrowserDesktopExportArtifactManifest([
            '/index.html',
            'zerith-player/index.js',
            String.raw`scenes\intro.json`,
            'zerith.content.json',
        ], {
            fileHashes: { '/zerith.content.json': 'abc123' },
            projectFiles: [
                String.raw`scenes\intro.json`,
            ],
        })).toEqual({
            fileHashes: { 'zerith.content.json': 'abc123' },
            files: [
                'index.html',
                'scenes/intro.json',
                'zerith-player/index.js',
                'zerith.content.json',
            ],
            projectFiles: [
                'scenes/intro.json',
            ],
        });
    });

    it('reports artifact hash mismatches and missing project/runtime files', () => {
        const comparison = compareBrowserDesktopExportArtifacts({
            fileHashes: { 'zerith.content.json': 'browser-hash' },
            files: [
                'index.html',
                'zerith.content.json',
                'game.json',
            ],
            projectFiles: ['game.json', 'scenes/intro.json'],
        }, {
            fileHashes: { 'zerith.content.json': 'desktop-hash' },
            files: [
                'index.html',
                'zerith.content.json',
                'assets/index.js',
                'game.json',
                'scenes/intro.json',
            ],
            projectFiles: ['game.json', 'scenes/intro.json'],
        });

        expect(comparison.summary).toEqual({
            matched: 1,
            mismatched: 1,
            missing: 2,
        });
        expect(comparison.checks.find((check) => check.id === 'compiledContent')).toMatchObject({
            status: 'mismatched',
        });
        expect(comparison.checks.find((check) => check.id === 'runtimeAssets')).toMatchObject({
            missingInBrowser: ['zerith-player/*.js'],
            status: 'missing',
        });
        expect(comparison.checks.find((check) => check.id === 'projectFiles')).toMatchObject({
            missingInBrowser: ['scenes/intro.json'],
            status: 'missing',
        });
    });
});

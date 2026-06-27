import { describe, expect, it } from 'vitest';

import { createGitIntegrationReport, createGitRemotePolicyReport } from '../gitIntegrationReport';

describe('gitIntegrationReport', () => {
    it('recommends a Tauri/Rust backend first on desktop', () => {
        const report = createGitIntegrationReport({ runtime: 'desktop' });

        expect(report.summary).toEqual({
            deferred: 0,
            limited: 1,
            recommended: 1,
            unsupported: 1,
        });
        expect(report.strategies.find((strategy) => strategy.id === 'tauriRustBackend')).toMatchObject({
            desktop: 'recommended',
        });
        expect(report.recommendedNextStep).toContain('Tauri/Rust');
    });

    it('defers browser git until repository access policy is explicit', () => {
        const report = createGitIntegrationReport({ runtime: 'browser' });

        expect(report.summary).toEqual({
            deferred: 1,
            limited: 0,
            recommended: 0,
            unsupported: 2,
        });
        expect(report.strategies.find((strategy) => strategy.id === 'browserWebGit')).toMatchObject({
            browser: 'deferred',
        });
        expect(report.recommendedNextStep).toContain('browser builds');
    });

    it('classifies remote credential policy from effective push URLs', () => {
        const report = createGitRemotePolicyReport([
            { fetchUrl: 'https://example.invalid/repo.git', name: 'https-origin' },
            { fetchUrl: 'https://example.invalid/fetch.git', name: 'ssh-origin', pushUrl: 'git@example.invalid:repo.git' },
            { name: 'local-backup', pushUrl: '../backup.git' },
            { name: 'missing' },
            { name: 'custom', pushUrl: 'custom-transport://repo' },
        ]);

        expect(report.summary).toEqual({
            blocked: 1,
            ready: 1,
            review: 3,
        });
        expect(report.recommendedRemote).toBe('ssh-origin');
        expect(report.entries.find((entry) => entry.name === 'https-origin')).toMatchObject({
            credentialMode: 'external-helper',
            effectivePushUrl: 'https://example.invalid/repo.git',
            status: 'review',
            transport: 'https',
        });
        expect(report.entries.find((entry) => entry.name === 'ssh-origin')).toMatchObject({
            credentialMode: 'ssh-agent',
            effectivePushUrl: 'git@example.invalid:repo.git',
            status: 'ready',
            transport: 'ssh',
        });
        expect(report.entries.find((entry) => entry.name === 'local-backup')).toMatchObject({
            credentialMode: 'none',
            status: 'review',
            transport: 'file',
        });
        expect(report.entries.find((entry) => entry.name === 'missing')).toMatchObject({
            credentialMode: 'missing',
            status: 'blocked',
            transport: 'missing',
        });
        expect(report.entries.find((entry) => entry.name === 'custom')).toMatchObject({
            credentialMode: 'unknown',
            status: 'review',
            transport: 'other',
        });
    });
});

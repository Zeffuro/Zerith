import { describe, expect, it, vi } from 'vitest';

import { normalizeGitDiffSummaryResponse, normalizeGitStatusResponse } from '../gitIntegration/normalizers';
import { createGitStageFileReport } from '../gitIntegration/stagingReports';

describe('Git filename fidelity across the native bridge', () => {
    it('preserves surrounding whitespace and explicit rename paths', () => {
        const path = 'project/ new 名.txt ';
        const originalPath = 'project/ old\tname.txt ';
        const status = normalizeGitStatusResponse({ entries: [{ index: 'R', originalPath, path, workingTree: ' ' }] });
        expect(status.entries[0]).toEqual({ index: 'R', originalPath, path, workingTree: ' ' });
        const summary = normalizeGitDiffSummaryResponse({ files: [{ insertions: 1, originalPath, path }] });
        expect(summary.files[0]?.path).toBe(path);
        expect(summary.files[0]?.originalPath).toBe(originalPath);
    });

    it('passes literal filename whitespace through staging', async () => {
        const invoke = vi.fn().mockResolvedValue({ isRepository: true, path: ' trailing.txt ' });
        const report = await createGitStageFileReport('/project', ' trailing.txt ', { invoke, isTauriRuntime: () => true });
        expect(invoke).toHaveBeenCalledWith('git_stage_file', { request: { path: ' trailing.txt ', projectPath: '/project' } });
        expect(report.status).toBe('staged');
    });

    it('preserves whitespace in selected project and repository directory names', async () => {
        const invoke = vi.fn().mockResolvedValue({ isRepository: true, path: 'story.txt', repositoryRoot: '/repository ' });
        const report = await createGitStageFileReport('/repository /project ', 'story.txt', { invoke, isTauriRuntime: () => true });
        expect(invoke).toHaveBeenCalledWith('git_stage_file', { request: { path: 'story.txt', projectPath: '/repository /project ' } });
        expect(report).toMatchObject({ repositoryRoot: '/repository ', status: 'staged' });
    });
});

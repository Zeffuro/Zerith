import { describe, expect, it } from 'vitest';

import { buildGitDiffLines, classifyGitDiffLine } from '../gitDiffViewerModel';

describe('gitDiffViewerModel', () => {
    it('classifies headers, hunks, additions, and deletions', () => {
        expect(classifyGitDiffLine('diff --git a/file b/file')).toBe('file');
        expect(classifyGitDiffLine('--- a/file')).toBe('file');
        expect(classifyGitDiffLine('+++ b/file')).toBe('file');
        expect(classifyGitDiffLine('@@ -1,2 +1,2 @@')).toBe('hunk');
        expect(classifyGitDiffLine('+added')).toBe('addition');
        expect(classifyGitDiffLine('-removed')).toBe('deletion');
        expect(classifyGitDiffLine('\\ No newline at end of file')).toBe('meta');
        expect(classifyGitDiffLine(' unchanged')).toBe('context');
    });

    it('builds line metadata with stable one-based line numbers', () => {
        expect(buildGitDiffLines('@@ -1 +1 @@\n-old\n+new')).toEqual([
            { kind: 'hunk', lineNumber: 1, text: '@@ -1 +1 @@' },
            { kind: 'deletion', lineNumber: 2, text: '-old' },
            { kind: 'addition', lineNumber: 3, text: '+new' },
        ]);
    });
});

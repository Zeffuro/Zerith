export type GitDiffLine = {
    kind: GitDiffLineKind;
    lineNumber: number;
    text: string;
};

export type GitDiffLineKind =
    | 'addition'
    | 'blank'
    | 'context'
    | 'deletion'
    | 'file'
    | 'hunk'
    | 'meta';

export function buildGitDiffLines(rawDiff: string | undefined): GitDiffLine[] {
    const lines = (rawDiff ?? '').replaceAll('\r\n', '\n').split('\n');
    if (lines.length === 1 && lines[0] === '') return [];

    return lines.map((text, index) => ({
        kind: classifyGitDiffLine(text),
        lineNumber: index + 1,
        text,
    }));
}

export function classifyGitDiffLine(text: string): GitDiffLineKind {
    if (text.length === 0) return 'blank';
    if (text.startsWith('@@')) return 'hunk';
    if (
        text.startsWith('diff --git ')
        || text.startsWith('index ')
        || text.startsWith('new file mode ')
        || text.startsWith('deleted file mode ')
        || text.startsWith('Binary file ')
        || text.startsWith('--- staged diff ---')
        || text.startsWith('--- unstaged diff ---')
        || text.startsWith('--- ')
        || text.startsWith('+++ ')
    ) {
        return 'file';
    }
    if (text.startsWith('+')) return 'addition';
    if (text.startsWith('-')) return 'deletion';
    if (text.startsWith(String.raw`\ No newline`)) return 'meta';
    return 'context';
}

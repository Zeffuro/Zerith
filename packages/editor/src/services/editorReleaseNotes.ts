export const EDITOR_RELEASES_PAGE_URL = 'https://github.com/Zeffuro/Zerith/releases';

const EDITOR_RELEASES_API_URL = 'https://api.github.com/repos/Zeffuro/Zerith/releases?per_page=10';
const EDITOR_RELEASE_TAG_PREFIX = 'editor-v';

export type EditorReleaseNote = {
    body: string;
    name: string;
    publishedAt?: string;
    tagName: string;
    url: string;
    version: string;
};

export type EditorReleaseNotesLoadResult =
    | {
        message: string;
        status: 'unavailable';
    }
    | {
        notes: EditorReleaseNote[];
        status: 'loaded';
    }
    | {
        status: 'empty';
    };

export type LoadEditorReleaseNotesDeps = {
    fetch?: typeof fetch;
    releasesApiUrl?: string;
};

export async function loadEditorReleaseNoteForVersion(
    version: string,
    deps: LoadEditorReleaseNotesDeps = {},
): Promise<EditorReleaseNote | undefined> {
    const result = await loadEditorReleaseNotes(deps);
    if (result.status !== 'loaded') return undefined;

    const tagName = `${EDITOR_RELEASE_TAG_PREFIX}${version}`;
    return result.notes.find((note) => note.version === version || note.tagName === tagName);
}

export async function loadEditorReleaseNotes(deps: LoadEditorReleaseNotesDeps = {}): Promise<EditorReleaseNotesLoadResult> {
    const fetch_ = deps.fetch ?? globalThis.fetch;
    if (typeof fetch_ !== 'function') {
        return { message: 'Release notes fetch is not available in this runtime.', status: 'unavailable' };
    }

    try {
        const response = await fetch_(deps.releasesApiUrl ?? EDITOR_RELEASES_API_URL, {
            headers: { Accept: 'application/vnd.github+json' },
        });

        if (!response.ok) {
            return { message: `GitHub Releases returned ${response.status} ${response.statusText}`.trim(), status: 'unavailable' };
        }

        const payload: unknown = await response.json();
        if (!Array.isArray(payload)) {
            return { message: 'GitHub Releases returned an unexpected payload.', status: 'unavailable' };
        }

        const notes = payload
            .map((value) => toEditorReleaseNote(value))
            .filter((note): note is EditorReleaseNote => note !== undefined);

        return notes.length > 0 ? { notes, status: 'loaded' } : { status: 'empty' };
    } catch (error) {
        return { message: error instanceof Error ? error.message : String(error), status: 'unavailable' };
    }
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
    const value = record[key];
    return typeof value === 'string' ? value : undefined;
}

function toEditorReleaseNote(value: unknown): EditorReleaseNote | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

    const release = value as Record<string, unknown>;
    const tagName = readString(release, 'tag_name');
    if (!tagName?.startsWith(EDITOR_RELEASE_TAG_PREFIX)) return undefined;

    return {
        body: readString(release, 'body')?.trim() || 'No release notes were published for this editor release.',
        name: readString(release, 'name')?.trim() || `Zerith Editor ${tagName.slice(EDITOR_RELEASE_TAG_PREFIX.length)}`,
        publishedAt: readString(release, 'published_at'),
        tagName,
        url: readString(release, 'html_url') || `${EDITOR_RELEASES_PAGE_URL}/tag/${tagName}`,
        version: tagName.slice(EDITOR_RELEASE_TAG_PREFIX.length),
    };
}

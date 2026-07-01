import { describe, expect, it, vi } from 'vitest';

import { loadEditorReleaseNotes } from '../editorReleaseNotes';

describe('loadEditorReleaseNotes', () => {
    it('loads editor-tagged GitHub release notes', async () => {
        const fetch = vi.fn(() => Promise.resolve({
            json: () => Promise.resolve([
                {
                    body: 'Changes for the editor.',
                    html_url: 'https://github.com/Zeffuro/Zerith/releases/tag/editor-v0.2.0',
                    name: 'Zerith Editor v0.2.0',
                    published_at: '2026-07-01T12:00:00Z',
                    tag_name: 'editor-v0.2.0',
                },
                {
                    body: 'Ignored non-editor release.',
                    html_url: 'https://github.com/Zeffuro/Zerith/releases/tag/player-v0.2.0',
                    name: 'Player v0.2.0',
                    tag_name: 'player-v0.2.0',
                },
            ]),
            ok: true,
            status: 200,
            statusText: 'OK',
        } as Response));

        await expect(loadEditorReleaseNotes({ fetch })).resolves.toEqual({
            notes: [
                {
                    body: 'Changes for the editor.',
                    name: 'Zerith Editor v0.2.0',
                    publishedAt: '2026-07-01T12:00:00Z',
                    tagName: 'editor-v0.2.0',
                    url: 'https://github.com/Zeffuro/Zerith/releases/tag/editor-v0.2.0',
                    version: '0.2.0',
                },
            ],
            status: 'loaded',
        });
    });

    it('reports empty when there are no editor releases', async () => {
        const fetch = vi.fn(() => Promise.resolve({
            json: () => Promise.resolve([]),
            ok: true,
            status: 200,
            statusText: 'OK',
        } as Response));

        await expect(loadEditorReleaseNotes({ fetch })).resolves.toEqual({ status: 'empty' });
    });

    it('reports unavailable when GitHub cannot be reached', async () => {
        const fetch = vi.fn(() => Promise.resolve({
            json: () => Promise.resolve({ message: 'rate limited' }),
            ok: false,
            status: 403,
            statusText: 'Forbidden',
        } as Response));

        await expect(loadEditorReleaseNotes({ fetch })).resolves.toEqual({
            message: 'GitHub Releases returned 403 Forbidden',
            status: 'unavailable',
        });
    });
});

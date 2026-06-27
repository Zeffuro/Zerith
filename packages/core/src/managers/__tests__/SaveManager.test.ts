import { describe, expect, it, vi } from 'vitest';

import type { IStorageProvider } from '../../interfaces/providers';

import { CURRENT_CONTENT_SCHEMA_VERSION, LEGACY_CONTENT_SCHEMA_VERSION } from '../../schemas/contentVersionSchemas';
import { createDefaultSystemState } from '../../types';
import {
    buildSavePreviewMeta,
    buildSaveThumbnailMeta,
    CURRENT_SAVE_SCHEMA_VERSION,
    isSaveThumbnailDataUrl,
    LEGACY_SAVE_SCHEMA_VERSION,
    type SaveContext,
    SaveManager,
} from '../SaveManager';

describe('SaveManager', () => {
    it('records content and save schema versions in new saves', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-25T12:00:00.000Z'));

        try {
            const storage = createMemoryStorage();
            const context = createSaveContext({
                getContentSchemaVersion: () => CURRENT_CONTENT_SCHEMA_VERSION,
                getCurrentSceneName: () => 'intro',
                getLastSavePoint: () => 7,
                getStateSnapshot: () => ({ affection: 2 }),
                serializeItems: () => ['badge'],
            });
            const manager = new SaveManager(context, storage);

            manager.save(2, 'Checkpoint');

            const rawSave = JSON.parse(storage.getItem('zerith_save_2') ?? 'null') as Record<string, unknown>;
            expect(rawSave).toMatchObject({
                contentSchemaVersion: CURRENT_CONTENT_SCHEMA_VERSION,
                index: 7,
                meta: {
                    contentSchemaVersion: CURRENT_CONTENT_SCHEMA_VERSION,
                    label: 'Checkpoint',
                    saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
                    sceneName: 'intro',
                    slot: 2,
                },
                saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
                sceneName: 'intro',
                state: { affection: 2 },
                system: { items: ['badge'], sprites: {}, weather: {} },
            });

            const loaded = await manager.load(2);
            expect(loaded).toMatchObject({
                contentSchemaVersion: CURRENT_CONTENT_SCHEMA_VERSION,
                saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
                sceneName: 'intro',
            });
            expect(manager.getMeta(2)).toMatchObject({
                contentSchemaVersion: CURRENT_CONTENT_SCHEMA_VERSION,
                saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
            });
        } finally {
            vi.useRealTimers();
        }
    });

    it('loads legacy saves without version metadata', async () => {
        const storage = createMemoryStorage();
        storage.setItem('zerith_save_1', JSON.stringify({
            index: 3,
            sceneName: 'legacy-intro',
            state: {
                __sys_bg: 'assets/bg/classroom.png',
                __sys_bgm: 'assets/bgm/theme.ogg',
                __sys_items: ['note'],
                affection: 1,
            },
        }));
        const manager = new SaveManager(createSaveContext(), storage);

        const loaded = await manager.load(1);

        expect(loaded).toMatchObject({
            contentSchemaVersion: LEGACY_CONTENT_SCHEMA_VERSION,
            index: 3,
            meta: {
                contentSchemaVersion: LEGACY_CONTENT_SCHEMA_VERSION,
                saveSchemaVersion: LEGACY_SAVE_SCHEMA_VERSION,
                sceneName: 'legacy-intro',
            },
            saveSchemaVersion: LEGACY_SAVE_SCHEMA_VERSION,
            sceneName: 'legacy-intro',
            state: { affection: 1 },
            system: {
                background: 'assets/bg/classroom.png',
                bgm: 'assets/bgm/theme.ogg',
                items: ['note'],
            },
        });
    });

    it.each([
        {
            expectedContentSchemaVersion: CURRENT_CONTENT_SCHEMA_VERSION,
            expectedSaveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
            name: 'root version metadata',
            save: {
                contentSchemaVersion: CURRENT_CONTENT_SCHEMA_VERSION,
                index: 4,
                meta: {
                    savedAt: 1,
                    sceneName: 'modern-root',
                    slot: 1,
                },
                saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
                sceneName: 'modern-root',
                state: { affection: 4 },
                system: createDefaultSystemState(),
            },
        },
        {
            expectedContentSchemaVersion: CURRENT_CONTENT_SCHEMA_VERSION,
            expectedSaveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
            name: 'meta-only version metadata',
            save: {
                index: 5,
                meta: {
                    contentSchemaVersion: CURRENT_CONTENT_SCHEMA_VERSION,
                    savedAt: 1,
                    saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
                    sceneName: 'modern-meta',
                    slot: 1,
                },
                sceneName: 'modern-meta',
                state: { affection: 5 },
                system: createDefaultSystemState(),
            },
        },
        {
            expectedContentSchemaVersion: LEGACY_CONTENT_SCHEMA_VERSION,
            expectedSaveSchemaVersion: LEGACY_SAVE_SCHEMA_VERSION,
            name: 'root metadata precedence over mismatched meta',
            save: {
                contentSchemaVersion: LEGACY_CONTENT_SCHEMA_VERSION,
                index: 6,
                meta: {
                    contentSchemaVersion: CURRENT_CONTENT_SCHEMA_VERSION,
                    savedAt: 1,
                    saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
                    sceneName: 'mixed-version',
                    slot: 1,
                },
                saveSchemaVersion: LEGACY_SAVE_SCHEMA_VERSION,
                sceneName: 'mixed-version',
                state: { affection: 6 },
                system: createDefaultSystemState(),
            },
        },
    ])('loads cross-version saves with $name', async ({
        expectedContentSchemaVersion,
        expectedSaveSchemaVersion,
        save,
    }) => {
        const storage = createMemoryStorage();
        storage.setItem('zerith_save_1', JSON.stringify(save));
        const manager = new SaveManager(createSaveContext(), storage);

        const loaded = await manager.load(1);

        expect(loaded?.contentSchemaVersion).toBe(expectedContentSchemaVersion);
        expect(loaded?.saveSchemaVersion).toBe(expectedSaveSchemaVersion);
        expect(loaded?.meta.contentSchemaVersion).toBe(expectedContentSchemaVersion);
        expect(loaded?.meta.saveSchemaVersion).toBe(expectedSaveSchemaVersion);
    });

    it('records a readable dialogue preview in save metadata', () => {
        const storage = createMemoryStorage();
        const system = createDefaultSystemState();
        system.dialogue = {
            speaker: '  Mira  ',
            text: 'Welcome back, {pause=250}<b>traveler</b>.\nPick up where you left off.',
        };
        const manager = new SaveManager(createSaveContext({
            getSystemSnapshot: () => system,
        }), storage);

        manager.save(1);

        const rawSave = JSON.parse(storage.getItem('zerith_save_1') ?? 'null') as Record<string, unknown>;
        expect(rawSave).toMatchObject({
            meta: {
                previewSpeaker: 'Mira',
                previewText: 'Welcome back, traveler. Pick up where you left off.',
            },
            system: {
                dialogue: {
                    speaker: '  Mira  ',
                    text: 'Welcome back, {pause=250}<b>traveler</b>.\nPick up where you left off.',
                },
            },
        });
        expect(manager.getMeta(1)).toMatchObject({
            previewSpeaker: 'Mira',
            previewText: 'Welcome back, traveler. Pick up where you left off.',
        });
    });

    it('records bookmark and chapter save metadata', async () => {
        const storage = createMemoryStorage();
        const manager = new SaveManager(createSaveContext({
            getCurrentChapterName: () => 'Chapter One',
        }), storage);

        manager.save(4, {
            bookmarkId: 'chapter-one-start',
            kind: 'bookmark',
            label: 'Chapter Start',
        });

        const loaded = await manager.load(4);

        expect(loaded?.meta).toMatchObject({
            bookmarkId: 'chapter-one-start',
            chapter: 'Chapter One',
            kind: 'bookmark',
            label: 'Chapter Start',
        });
    });

    it('records bounded dialogue history in save system state', async () => {
        const storage = createMemoryStorage();
        const history = Array.from({ length: 205 }, (_, index) => ({
            speaker: `Speaker ${index}`,
            text: `Line ${index}`,
            timestamp: index,
        }));
        const manager = new SaveManager(createSaveContext({
            getHistorySnapshot: () => history,
        }), storage);

        manager.save(1);

        const rawSave = JSON.parse(storage.getItem('zerith_save_1') ?? 'null') as {
            system?: { history?: unknown[] };
        };
        expect(rawSave.system?.history).toHaveLength(200);
        expect(rawSave.system?.history?.[0]).toMatchObject({
            speaker: 'Speaker 5',
            text: 'Line 5',
            timestamp: 5,
        });

        const loaded = await manager.load(1);
        expect(loaded?.system.history).toHaveLength(200);
        expect(loaded?.system.history?.at(-1)).toMatchObject({
            speaker: 'Speaker 204',
            text: 'Line 204',
            timestamp: 204,
        });
    });

    it('sanitizes malformed dialogue history when loading saves', async () => {
        const storage = createMemoryStorage();
        storage.setItem('zerith_save_1', JSON.stringify({
            index: 0,
            sceneName: 'intro',
            state: {},
            system: {
                ...createDefaultSystemState(),
                history: [
                    { speaker: 'Mira', text: 'Valid line.', timestamp: 1 },
                    { speaker: 'Broken', text: 99, timestamp: 2 },
                    { speaker: 'Narrator', text: 'Still valid.', timestamp: 3 },
                ],
            },
        }));
        const manager = new SaveManager(createSaveContext(), storage);

        const loaded = await manager.load(1);

        expect(loaded?.system.history).toEqual([
            { speaker: 'Mira', text: 'Valid line.', timestamp: 1 },
            { speaker: 'Narrator', text: 'Still valid.', timestamp: 3 },
        ]);
    });

    it('truncates long save preview text', () => {
        const preview = buildSavePreviewMeta({
            speaker: 'Narrator',
            text: 'A'.repeat(140),
        });

        expect(preview.previewText).toHaveLength(120);
        expect(preview.previewText?.endsWith('...')).toBe(true);
    });

    it('records a bounded save thumbnail when capture is available', () => {
        const storage = createMemoryStorage();
        const thumbnailDataUrl = 'data:image/webp;base64,AAAA';
        const manager = new SaveManager(createSaveContext({
            captureThumbnailDataUrl: () => thumbnailDataUrl,
        }), storage);

        manager.save(1);

        const rawSave = JSON.parse(storage.getItem('zerith_save_1') ?? 'null') as Record<string, unknown>;
        expect(rawSave).toMatchObject({
            meta: {
                thumbnailDataUrl,
            },
        });
        expect(manager.getMeta(1)?.thumbnailDataUrl).toBe(thumbnailDataUrl);
    });

    it('omits invalid thumbnail data URLs from new save metadata', () => {
        expect(isSaveThumbnailDataUrl('data:image/webp;base64,AAAA')).toBe(true);
        expect(buildSaveThumbnailMeta('data:image/svg+xml;base64,AAAA')).toEqual({});
        expect(buildSaveThumbnailMeta(`data:image/png;base64,${'A'.repeat(300_001)}`)).toEqual({});
    });
});

function createMemoryStorage(): IStorageProvider {
    const values = new Map<string, string>();

    return {
        getItem: (key) => values.get(key),
        removeItem: (key) => {
            values.delete(key);
        },
        setItem: (key, value) => {
            values.set(key, value);
        },
    };
}

function createSaveContext(overrides: Partial<SaveContext> = {}): SaveContext {
    return {
        getCurrentSceneName: () => 'intro',
        getLastSavePoint: () => 0,
        getStateSnapshot: () => ({}),
        getSystemSnapshot: () => createDefaultSystemState(),
        logInfo: vi.fn(),
        logWarn: vi.fn(),
        serializeItems: () => [],
        ...overrides,
    };
}

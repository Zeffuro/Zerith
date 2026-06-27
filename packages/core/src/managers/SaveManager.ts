import type { SpriteState } from '../handlers/SpriteHandler';
import type { WeatherEffectState } from '../handlers/WeatherHandler';
import type { ISaveManager } from '../interfaces/managers';
import type { IStorageProvider } from '../interfaces/providers';
import type { ContentSchemaVersion } from '../schemas/contentVersionSchemas';
import type { Serializable, SystemState } from '../types';
import type { HistoryEntry } from './HistoryManager';

import { CURRENT_CONTENT_SCHEMA_VERSION, LEGACY_CONTENT_SCHEMA_VERSION } from '../schemas/contentVersionSchemas';
import { createDefaultSystemState } from '../types';
import { deepClone } from '../utils/deepClone';

export const CURRENT_SAVE_SCHEMA_VERSION = 1 as const;
export const LEGACY_SAVE_SCHEMA_VERSION = 0 as const;

export interface SaveContext {
    captureThumbnailDataUrl?: () => string | undefined;
    getContentSchemaVersion?: () => ContentSchemaVersion;
    getCurrentChapterName?: () => string | undefined;
    getCurrentSceneName(): string;
    getHistorySnapshot?: () => readonly HistoryEntry[];
    getLastSavePoint(): number;
    getStateSnapshot(): Record<string, Serializable>;
    getSystemSnapshot(): SystemState;
    logInfo(message: string): void;
    logWarn(message: string): void;
    serializeItems(): string[];
}

export interface SaveMeta {
    bookmarkId?: string;
    chapter?: string;
    contentSchemaVersion?: ContentSchemaVersion;
    kind?: SaveSlotKind;
    label?: string;
    previewSpeaker?: string;
    previewText?: string;
    savedAt: number;
    saveSchemaVersion?: SaveSchemaVersion;
    sceneName: string;
    slot: number;
    thumbnailDataUrl?: string;
}

export interface SaveOptions {
    bookmarkId?: string;
    chapter?: string;
    kind?: SaveSlotKind;
    label?: string;
}

export type SaveSchemaVersion = typeof CURRENT_SAVE_SCHEMA_VERSION | typeof LEGACY_SAVE_SCHEMA_VERSION;
export type SaveSlotKind = 'bookmark' | 'chapter' | 'manual';

export interface SaveState {
    contentSchemaVersion?: ContentSchemaVersion;
    index: number;
    meta: SaveMeta;
    saveSchemaVersion?: SaveSchemaVersion;
    sceneName: string;
    state: Record<string, Serializable>;
    system: SystemState;
}

const SAVE_PREVIEW_MAX_LENGTH = 120;
const SAVE_HISTORY_MAX_ENTRIES = 200;
const SAVE_THUMBNAIL_MAX_LENGTH = 300_000;
const SAVE_THUMBNAIL_PATTERN = /^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=]+$/i;

const LEGACY_SYSTEM_KEYS = new Set([
    '__sys_background',
    '__sys_bg',
    '__sys_bgm',
    '__sys_dialogue',
    '__sys_items',
    '__sys_sprites',
]);

const WEATHER_PRESET_VALUES: ReadonlySet<unknown> = new Set([
    'ash',
    'ashfall',
    'blizzard',
    'drizzle',
    'embers',
    'heavy_rain',
    'rain',
    'snow',
    'snowfall',
    'storm',
]);

export class SaveManager implements ISaveManager {
    private readonly context: SaveContext;
    private destroyed = false;
    private readonly prefix: string;
    private readonly storage: IStorageProvider;

    constructor(context: SaveContext, storage: IStorageProvider, prefix: string = 'zerith_save') {
        this.context = context;
        this.storage = storage;
        this.prefix = prefix;
    }

    public deleteSlot(slot: number) {
        if (this.destroyed) return;
        this.storage.removeItem(`${this.prefix}_${slot}`);
        this.context.logInfo(`Save slot ${slot} deleted`);
    }

    public destroy(): void {
        this.destroyed = true;
    }

    public getMeta(slot: number): SaveMeta | undefined {
        if (this.destroyed) return undefined;
        const saveString = this.storage.getItem(`${this.prefix}_${slot}`);
        if (!saveString) return undefined;

        const saveData = this.parseSaveState(saveString);
        if (!saveData) {
            return undefined;
        }

        return saveData.meta ?? {
            savedAt: 0,
            sceneName: saveData.sceneName,
            slot
        };
    }

    public hasSlot(slot: number): boolean {
        if (this.destroyed) return false;
        return this.storage.getItem(`${this.prefix}_${slot}`) !== undefined;
    }

    public listSlots(maxSlots: number = 10): (SaveMeta | undefined)[] {
        if (this.destroyed) return [];
        const slots: (SaveMeta | undefined)[] = [];
        for (let index = 1; index <= maxSlots; index++) {
            slots.push(this.getMeta(index));
        }
        return slots;
    }

    public load(slot: number = 1): Promise<SaveState | undefined> {
        if (this.destroyed) return Promise.resolve<SaveState | undefined>(void 0);
        const saveString = this.storage.getItem(`${this.prefix}_${slot}`);
        if (!saveString) {
            this.context.logWarn(`No save found in slot ${slot}`);
            return Promise.resolve<SaveState | undefined>(void 0);
        }

        const saveData = this.parseSaveState(saveString);
        if (!saveData) {
            this.context.logWarn(`Save data in slot ${slot} is invalid`);
            return Promise.resolve<SaveState | undefined>(void 0);
        }
        this.context.logInfo(`Loading save from slot ${slot}...`);
        return Promise.resolve(saveData);
    }

    public loadGlobalState(): Record<string, Serializable> {
        if (this.destroyed) return {};
        const stateJson = this.storage.getItem(`${this.prefix}_global`);
        if (!stateJson) {
            return {};
        }

        try {
            const parsed: unknown = JSON.parse(stateJson);
            return this.isSerializableRecord(parsed) ? parsed : {};
        } catch {
            return {};
        }
    }

    public save(slot: number = 1, labelOrOptions?: SaveOptions | string) {
        if (this.destroyed) return;
        const options = normalizeSaveOptions(labelOrOptions);
        const currentSceneName = this.context.getCurrentSceneName();
        const contentSchemaVersion = this.context.getContentSchemaVersion?.() ?? LEGACY_CONTENT_SCHEMA_VERSION;
        const systemSnapshot = deepClone(this.context.getSystemSnapshot());
        const historySnapshot = normalizeSaveHistoryEntries(
            this.context.getHistorySnapshot?.() ?? systemSnapshot.history
        );
        const bookmarkId = normalizeSaveMetaString(options.bookmarkId);
        const chapter = normalizeSaveMetaString(options.chapter)
            ?? normalizeSaveMetaString(this.context.getCurrentChapterName?.());
        const label = normalizeSaveMetaString(options.label);
        const meta: SaveMeta = {
            ...(bookmarkId ? { bookmarkId } : {}),
            ...(chapter ? { chapter } : {}),
            contentSchemaVersion,
            kind: options.kind ?? (bookmarkId ? 'bookmark' : 'manual'),
            ...(label ? { label } : {}),
            ...buildSavePreviewMeta(systemSnapshot.dialogue),
            ...buildSaveThumbnailMeta(this.captureThumbnailDataUrl()),
            savedAt: Date.now(),
            saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
            sceneName: currentSceneName,
            slot
        };

        const saveData: SaveState = {
            contentSchemaVersion,
            index: this.context.getLastSavePoint(),
            meta,
            saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
            sceneName: currentSceneName,
            state: deepClone(this.context.getStateSnapshot()),
            system: withOptionalHistory({
                ...systemSnapshot,
                items: this.context.serializeItems(),
            }, historySnapshot),
        };

        this.storage.setItem(`${this.prefix}_${slot}`, JSON.stringify(saveData));
        this.context.logInfo(`Game saved to slot ${slot}`);
    }

    public saveGlobalState(state: Record<string, Serializable>): void {
        if (this.destroyed) return;
        this.storage.setItem(`${this.prefix}_global`, JSON.stringify(state));
    }

    private captureThumbnailDataUrl(): string | undefined {
        const capture = this.context.captureThumbnailDataUrl;
        if (!capture) return undefined;

        try {
            return capture();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.context.logWarn(`Save thumbnail capture failed: ${message}`);
            return undefined;
        }
    }

    private isContentSchemaVersion(value: unknown): value is ContentSchemaVersion {
        return value === LEGACY_CONTENT_SCHEMA_VERSION || value === CURRENT_CONTENT_SCHEMA_VERSION;
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null;
    }

    private isSaveMeta(value: unknown): value is SaveMeta {
        if (!this.isRecord(value)) return false;
        const bookmarkIdOk = value.bookmarkId === undefined || typeof value.bookmarkId === 'string';
        const chapterOk = value.chapter === undefined || typeof value.chapter === 'string';
        const labelOk = value.label === undefined || typeof value.label === 'string';
        const kindOk = value.kind === undefined || this.isSaveSlotKind(value.kind);
        const previewSpeakerOk = value.previewSpeaker === undefined || typeof value.previewSpeaker === 'string';
        const previewTextOk = value.previewText === undefined || typeof value.previewText === 'string';
        const thumbnailOk = value.thumbnailDataUrl === undefined || typeof value.thumbnailDataUrl === 'string';
        const contentSchemaVersionOk = value.contentSchemaVersion === undefined
            || this.isContentSchemaVersion(value.contentSchemaVersion);
        const saveSchemaVersionOk = value.saveSchemaVersion === undefined
            || this.isSaveSchemaVersion(value.saveSchemaVersion);
        return bookmarkIdOk
            && chapterOk
            && kindOk
            && labelOk
            && previewSpeakerOk
            && previewTextOk
            && thumbnailOk
            && contentSchemaVersionOk
            && saveSchemaVersionOk
            && typeof value.savedAt === 'number'
            && typeof value.sceneName === 'string'
            && typeof value.slot === 'number';
    }

    private isSaveSchemaVersion(value: unknown): value is SaveSchemaVersion {
        return value === LEGACY_SAVE_SCHEMA_VERSION || value === CURRENT_SAVE_SCHEMA_VERSION;
    }

    private isSaveSlotKind(value: unknown): value is SaveSlotKind {
        return typeof value === 'string' && ['bookmark', 'chapter', 'manual'].includes(value);
    }

    private isSerializable(value: unknown): value is Serializable {
        if (value === null) return true;
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            return true;
        }
        if (Array.isArray(value)) {
            return value.every((item) => this.isSerializable(item));
        }
        if (this.isRecord(value)) {
            return Object.values(value).every((item) => this.isSerializable(item));
        }
        return false;
    }

    private isSerializableRecord(value: unknown): value is Record<string, Serializable> {
        if (!this.isRecord(value)) return false;
        for (const item of Object.values(value)) {
            if (!this.isSerializable(item)) return false;
        }
        return true;
    }

    private isStringArray(value: unknown): value is string[] {
        return Array.isArray(value) && value.every((item) => typeof item === 'string');
    }

    private parseSaveState(json: string): SaveState | undefined {
        try {
            const parsed: unknown = JSON.parse(json);
            if (!this.isRecord(parsed)) return undefined;
            if (typeof parsed.index !== 'number') return undefined;
            if (typeof parsed.sceneName !== 'string') return undefined;
            if (!this.isSerializableRecord(parsed.state)) return undefined;

            const meta = parsed.meta;
            if (meta !== undefined && !this.isSaveMeta(meta)) return undefined;
            const contentSchemaVersion = this.toContentSchemaVersion(parsed.contentSchemaVersion)
                ?? (this.isSaveMeta(meta) ? meta.contentSchemaVersion : undefined)
                ?? LEGACY_CONTENT_SCHEMA_VERSION;
            const saveSchemaVersion = this.toSaveSchemaVersion(parsed.saveSchemaVersion)
                ?? (this.isSaveMeta(meta) ? meta.saveSchemaVersion : undefined)
                ?? LEGACY_SAVE_SCHEMA_VERSION;
            const parsedMeta = this.isSaveMeta(meta)
                ? meta
                : {
                    savedAt: 0,
                    sceneName: parsed.sceneName,
                    slot: 0
                };

            const parsedSystem = this.toSystemState(parsed.system);

            return {
                contentSchemaVersion,
                index: parsed.index,
                meta: {
                    ...parsedMeta,
                    contentSchemaVersion,
                    saveSchemaVersion,
                },
                saveSchemaVersion,
                sceneName: parsed.sceneName,
                state: this.sanitizeUserState(parsed.state),
                system: parsedSystem ?? this.readLegacySystemState(parsed.state),
            };
        } catch {
            return undefined;
        }
    }

    private readLegacySystemState(state: Record<string, Serializable>): SystemState {
        const system = createDefaultSystemState();
        const legacyBackground = state.__sys_background;
        const legacyBackgroundUrl = this.isRecord(legacyBackground) && typeof legacyBackground.assetUrl === 'string'
            ? legacyBackground.assetUrl
            : undefined;
        const legacySprites = state.__sys_sprites;
        const legacyDialogue = state.__sys_dialogue;

        if (typeof state.__sys_bg === 'string') {
            system.background = state.__sys_bg;
        } else if (legacyBackgroundUrl) {
            system.background = legacyBackgroundUrl;
        }

        if (typeof state.__sys_bgm === 'string') {
            system.bgm = state.__sys_bgm;
        }

        if (this.isStringArray(state.__sys_items)) {
            system.items = [...state.__sys_items];
        }

        if (this.isRecord(legacySprites)) {
            system.sprites = legacySprites as Record<string, SpriteState>;
        }

        if (
            this.isRecord(legacyDialogue)
            && typeof legacyDialogue.speaker === 'string'
            && typeof legacyDialogue.text === 'string'
        ) {
            system.dialogue = {
                portraitSide: legacyDialogue.portraitSide === 'left' || legacyDialogue.portraitSide === 'right'
                    ? legacyDialogue.portraitSide
                    : undefined,
                portraitUrl: typeof legacyDialogue.portraitUrl === 'string'
                    ? legacyDialogue.portraitUrl
                    : undefined,
                speaker: legacyDialogue.speaker,
                text: legacyDialogue.text,
            };
        }

        return system;
    }

    private sanitizeUserState(state: Record<string, Serializable>): Record<string, Serializable> {
        const sanitized: Record<string, Serializable> = {};
        for (const [key, value] of Object.entries(state)) {
            if (!LEGACY_SYSTEM_KEYS.has(key)) {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }

    private toContentSchemaVersion(value: unknown): ContentSchemaVersion | undefined {
        return this.isContentSchemaVersion(value) ? value : undefined;
    }

    private toSaveSchemaVersion(value: unknown): SaveSchemaVersion | undefined {
        return this.isSaveSchemaVersion(value) ? value : undefined;
    }

    private toSystemState(value: unknown): SystemState | undefined {
        if (!this.isRecord(value)) return undefined;

        const state = createDefaultSystemState();

        if (typeof value.background === 'string') {
            state.background = value.background;
        }

        if (typeof value.bgm === 'string') {
            state.bgm = value.bgm;
        }

        if (Array.isArray(value.items) && value.items.every((item) => typeof item === 'string')) {
            state.items = [...value.items];
        }

        if (this.isRecord(value.sprites)) {
            state.sprites = value.sprites as Record<string, SpriteState>;
        }

        if (this.isRecord(value.weather)) {
            state.weather = this.toWeatherState(value.weather);
        }

        if (
            this.isRecord(value.dialogue)
            && typeof value.dialogue.speaker === 'string'
            && typeof value.dialogue.text === 'string'
        ) {
            state.dialogue = {
                portraitSide: value.dialogue.portraitSide === 'left' || value.dialogue.portraitSide === 'right'
                    ? value.dialogue.portraitSide
                    : undefined,
                portraitUrl: typeof value.dialogue.portraitUrl === 'string'
                    ? value.dialogue.portraitUrl
                    : undefined,
                speaker: value.dialogue.speaker,
                text: value.dialogue.text,
            };
        }

        const history = normalizeSaveHistoryEntries(value.history);
        if (history.length > 0) {
            state.history = history;
        }

        return state;
    }

    private toWeatherLayer(value: unknown): WeatherEffectState['layer'] {
        return typeof value === 'string' && value.trim().length > 0 && value !== 'ui'
            ? value.trim()
            : undefined;
    }

    private toWeatherPreset(value: unknown): undefined | WeatherEffectState['preset'] {
        return isWeatherPreset(value)
            ? value
            : undefined;
    }

    private toWeatherState(value: Record<string, unknown>): Record<string, WeatherEffectState> {
        const weather: Record<string, WeatherEffectState> = {};

        for (const [key, entry] of Object.entries(value)) {
            if (!this.isRecord(entry)) continue;

            const id = typeof entry.id === 'string' && entry.id.trim().length > 0
                ? entry.id.trim()
                : key;
            const preset = this.toWeatherPreset(entry.preset);
            if (!preset) continue;

            weather[id] = {
                alpha: typeof entry.alpha === 'number' ? entry.alpha : undefined,
                angle: typeof entry.angle === 'number' ? entry.angle : undefined,
                color: typeof entry.color === 'number' ? entry.color : undefined,
                density: typeof entry.density === 'number' ? entry.density : undefined,
                id,
                layer: this.toWeatherLayer(entry.layer),
                preset,
                size: typeof entry.size === 'number' ? entry.size : undefined,
                speed: typeof entry.speed === 'number' ? entry.speed : undefined,
                wind: typeof entry.wind === 'number' ? entry.wind : undefined,
            };
        }

        return weather;
    }
}

export function buildSavePreviewMeta(dialogue: SystemState['dialogue'] | undefined): Pick<SaveMeta, 'previewSpeaker' | 'previewText'> {
    if (!dialogue) return {};

    const previewSpeaker = normalizeSavePreviewValue(dialogue.speaker);
    const previewText = truncateSavePreviewText(normalizeSavePreviewValue(stripRuntimeTextMarkup(dialogue.text)));

    return {
        ...(previewSpeaker ? { previewSpeaker } : {}),
        ...(previewText ? { previewText } : {}),
    };
}

export function buildSaveThumbnailMeta(thumbnailDataUrl: string | undefined): Pick<SaveMeta, 'thumbnailDataUrl'> {
    return isSaveThumbnailDataUrl(thumbnailDataUrl) ? { thumbnailDataUrl } : {};
}

export function isSaveThumbnailDataUrl(value: unknown): value is string {
    return typeof value === 'string'
        && value.length <= SAVE_THUMBNAIL_MAX_LENGTH
        && SAVE_THUMBNAIL_PATTERN.test(value);
}

function isSaveHistoryEntry(value: unknown): value is HistoryEntry {
    return typeof value === 'object'
        && value !== null
        && 'speaker' in value
        && 'text' in value
        && 'timestamp' in value
        && typeof value.speaker === 'string'
        && typeof value.text === 'string'
        && typeof value.timestamp === 'number'
        && Number.isFinite(value.timestamp);
}

function isWeatherPreset(value: unknown): value is WeatherEffectState['preset'] {
    return WEATHER_PRESET_VALUES.has(value);
}

function normalizeSaveHistoryEntries(value: unknown): HistoryEntry[] {
    if (!Array.isArray(value)) return [];

    const entries: HistoryEntry[] = [];
    for (const entry of value) {
        if (!isSaveHistoryEntry(entry)) continue;

        entries.push({
            speaker: entry.speaker,
            text: entry.text,
            timestamp: entry.timestamp,
        });
    }

    return entries.slice(-SAVE_HISTORY_MAX_ENTRIES);
}

function normalizeSaveMetaString(value: string | undefined): string | undefined {
    const normalized = value?.trim();
    return normalized && normalized.length > 0 ? normalized : undefined;
}

function normalizeSaveOptions(value: SaveOptions | string | undefined): SaveOptions {
    return typeof value === 'string'
        ? { label: value }
        : (value ?? {});
}

function normalizeSavePreviewValue(value: string | undefined): string | undefined {
    const normalized = value?.replaceAll(/\s+/g, ' ').trim();
    return normalized && normalized.length > 0 ? normalized : undefined;
}

function stripRuntimeTextMarkup(value: string): string {
    return value
        .replaceAll(/{[^}]+}/g, '')
        .replaceAll(/<[^>]+>/g, '');
}

function truncateSavePreviewText(value: string | undefined): string | undefined {
    if (!value || value.length <= SAVE_PREVIEW_MAX_LENGTH) return value;
    return `${value.slice(0, SAVE_PREVIEW_MAX_LENGTH - 3).trimEnd()}...`;
}

function withOptionalHistory(system: SystemState, history: HistoryEntry[]): SystemState {
    if (history.length === 0) {
        const systemWithoutHistory = { ...system };
        delete systemWithoutHistory.history;
        return systemWithoutHistory;
    }

    return {
        ...system,
        history,
    };
}

import type { SpriteState } from '../handlers/SpriteHandler';
import type { IStorageProvider } from '../interfaces/providers';
import type { Serializable, SystemState } from '../types';

import { createDefaultSystemState } from '../types';

export interface SaveContext {
    getCurrentSceneName(): string;
    getLastSavePoint(): number;
    getStateSnapshot(): Record<string, Serializable>;
    getSystemSnapshot(): SystemState;
    logInfo(message: string): void;
    logWarn(message: string): void;
    serializeItems(): string[];
}

export interface SaveMeta {
    label?: string;
    savedAt: number;
    sceneName: string;
    slot: number;
}

export interface SaveState {
    index: number;
    meta: SaveMeta;
    sceneName: string;
    state: Record<string, Serializable>;
    system: SystemState;
}

const LEGACY_SYSTEM_KEYS = new Set([
    '__sys_background',
    '__sys_bg',
    '__sys_bgm',
    '__sys_dialogue',
    '__sys_items',
    '__sys_sprites',
]);

export class SaveManager {
    private readonly context: SaveContext;
    private readonly prefix: string;
    private readonly storage: IStorageProvider;

    constructor(context: SaveContext, storage: IStorageProvider, prefix: string = 'zerith_save') {
        this.context = context;
        this.storage = storage;
        this.prefix = prefix;
    }

    public deleteSlot(slot: number) {
        this.storage.removeItem(`${this.prefix}_${slot}`);
        this.context.logInfo(`Save slot ${slot} deleted`);
    }

    public getMeta(slot: number): SaveMeta | undefined {
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
        return this.storage.getItem(`${this.prefix}_${slot}`) !== null;
    }

    public listSlots(maxSlots: number = 10): (SaveMeta | undefined)[] {
        const slots: (SaveMeta | undefined)[] = [];
        for (let index = 1; index <= maxSlots; index++) {
            slots.push(this.getMeta(index));
        }
        return slots;
    }

    public load(slot: number = 1): Promise<SaveState | undefined> {
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

    public save(slot: number = 1, label?: string) {
        const currentSceneName = this.context.getCurrentSceneName();
        const meta: SaveMeta = {
            label,
            savedAt: Date.now(),
            sceneName: currentSceneName,
            slot
        };

        const saveData: SaveState = {
            index: this.context.getLastSavePoint(),
            meta,
            sceneName: currentSceneName,
            state: structuredClone(this.context.getStateSnapshot()),
            system: {
                ...structuredClone(this.context.getSystemSnapshot()),
                items: this.context.serializeItems(),
            },
        };

        this.storage.setItem(`${this.prefix}_${slot}`, JSON.stringify(saveData));
        this.context.logInfo(`Game saved to slot ${slot}`);
    }

    public loadGlobalState(): Record<string, Serializable> {
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

    public saveGlobalState(state: Record<string, Serializable>): void {
        this.storage.setItem(`${this.prefix}_global`, JSON.stringify(state));
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null;
    }

    private isSaveMeta(value: unknown): value is SaveMeta {
        if (!this.isRecord(value)) return false;
        const labelOk = value.label === undefined || typeof value.label === 'string';
        return labelOk
            && typeof value.savedAt === 'number'
            && typeof value.sceneName === 'string'
            && typeof value.slot === 'number';
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

            const parsedSystem = this.toSystemState(parsed.system);

            return {
                index: parsed.index,
                meta: this.isSaveMeta(meta)
                    ? meta
                    : {
                        savedAt: 0,
                        sceneName: parsed.sceneName,
                        slot: 0
                    },
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

        return state;
    }
}
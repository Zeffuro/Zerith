import type { Engine } from '../Engine';
import type { SpriteState } from '../handlers/SpriteHandler';
import type { Serializable } from '../types';

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
}

export class SaveManager {
    private engine: Engine;
    private readonly prefix: string;

    constructor(engine: Engine, prefix: string = 'zerith_save') {
        this.engine = engine;
        this.prefix = prefix;
    }

    public deleteSlot(slot: number) {
        localStorage.removeItem(`${this.prefix}_${slot}`);
        this.engine.logger.info(`Save slot ${slot} deleted`);
    }

    public getMeta(slot: number): SaveMeta | undefined {
        const saveString = localStorage.getItem(`${this.prefix}_${slot}`);
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
        return localStorage.getItem(`${this.prefix}_${slot}`) !== null;
    }

    public listSlots(maxSlots: number = 10): (SaveMeta | undefined)[] {
        const slots: (SaveMeta | undefined)[] = [];
        for (let index = 1; index <= maxSlots; index++) {
            slots.push(this.getMeta(index));
        }
        return slots;
    }

    public async load(slot: number = 1) {
        const saveString = localStorage.getItem(`${this.prefix}_${slot}`);
        if (!saveString) {
            this.engine.logger.warn(`No save found in slot ${slot}`);
            return;
        }

        const saveData = this.parseSaveState(saveString);
        if (!saveData) {
            this.engine.logger.warn(`Save data in slot ${slot} is invalid`);
            return;
        }
        this.engine.logger.info(`Loading save from slot ${slot}...`);

        this.engine.clear();

        this.engine.state = saveData.state;
        const itemIds = this.engine.getState<Serializable>('__sys_items');
        if (this.isStringArray(itemIds)) {
            this.engine.items.deserialize(itemIds);
        }

        const bgUrl = this.engine.getState<string | undefined>('__sys_bg')
            ?? this.engine.getState<{ assetUrl?: string } | undefined>('__sys_background')?.assetUrl;
        if (bgUrl) await this.engine.runCommand({ assetUrl: bgUrl, type: 'background' });

        const bgmUrl = this.engine.getState<string | undefined>('__sys_bgm');
        if (bgmUrl) await this.engine.runCommand({ action: 'play', assetUrl: bgmUrl, type: 'bgm' });

        const sprites = this.engine.getState<Record<string, SpriteState> | undefined>('__sys_sprites');
        if (sprites && typeof sprites === 'object') {
            for (const [id, s] of Object.entries(sprites)) {
                await this.engine.runCommand({
                    action: 'show',
                    anchorX: s.anchorX,
                    anchorY: s.anchorY,
                    assetUrl: s.assetUrl,
                    flip: s.flip,
                    id,
                    pose: s.pose,
                    scaleX: s.scaleX,
                    scaleY: s.scaleY,
                    transition: 'instant',
                    type: 'sprite',
                    x: s.x,
                    y: s.y,
                });

                if (s.animation) {
                    await this.engine.runCommand({
                        action: 'animate',
                        animation: s.animation,
                        id,
                        type: 'sprite',
                    });
                }
            }
        }

        await this.engine.scenes.jumpToScene(saveData.sceneName, saveData.index);
        if (this.engine.isStarted) {
            await this.engine.playNext();
        }
    }

    public save(slot: number = 1, label?: string) {
        const meta: SaveMeta = {
            label,
            savedAt: Date.now(),
            sceneName: this.engine.currentSceneName,
            slot
        };

        const saveData: SaveState = {
            index: this.engine.lastSavePoint,
            meta,
            sceneName: this.engine.currentSceneName,
            state: structuredClone(this.engine.state)
        };

        localStorage.setItem(`${this.prefix}_${slot}`, JSON.stringify(saveData));
        this.engine.logger.info(`Game saved to slot ${slot}`);
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

    private isSerializableRecord(value: unknown): value is Record<string, Serializable> {
        if (!this.isRecord(value)) return false;
        for (const item of Object.values(value)) {
            if (!this.isSerializable(item)) return false;
        }
        return true;
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

    private isStringArray(value: unknown): value is string[] {
        return Array.isArray(value) && value.every((item) => typeof item === 'string');
    }

    private parseSaveState(json: string): SaveState | undefined {
        try {
            const parsed = JSON.parse(json);
            if (!this.isRecord(parsed)) return undefined;
            if (typeof parsed.index !== 'number') return undefined;
            if (typeof parsed.sceneName !== 'string') return undefined;
            if (!this.isSerializableRecord(parsed.state)) return undefined;

            const meta = parsed.meta;
            if (meta !== undefined && !this.isSaveMeta(meta)) return undefined;

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
                state: parsed.state
            };
        } catch {
            return undefined;
        }
    }
}
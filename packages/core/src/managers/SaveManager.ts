import type { Engine } from '../Engine';

export interface SaveState {
    sceneName: string;
    index: number;
    state: Record<string, any>;
    meta: SaveMeta;
}

export interface SaveMeta {
    slot: number;
    savedAt: number;
    sceneName: string;
    label?: string;
}

export class SaveManager {
    private engine: Engine;
    private prefix: string;

    constructor(engine: Engine, prefix: string = 'zerith_save') {
        this.engine = engine;
        this.prefix = prefix;
    }

    public save(slot: number = 1, label?: string) {
        const meta: SaveMeta = {
            slot,
            savedAt: Date.now(),
            sceneName: this.engine.currentSceneName,
            label
        };

        const saveData: SaveState = {
            sceneName: this.engine.currentSceneName,
            index: this.engine.lastSavePoint,
            state: JSON.parse(JSON.stringify(this.engine.state)),
            meta
        };

        localStorage.setItem(`${this.prefix}_${slot}`, JSON.stringify(saveData));
        this.engine.logger.info(`Game saved to slot ${slot}`);
    }

    public async load(slot: number = 1) {
        const saveStr = localStorage.getItem(`${this.prefix}_${slot}`);
        if (!saveStr) {
            this.engine.logger.warn(`No save found in slot ${slot}`);
            return;
        }

        const saveData: SaveState = JSON.parse(saveStr);
        this.engine.logger.info(`Loading save from slot ${slot}...`);

        this.engine.clear();

        this.engine.state = saveData.state;
        const itemIds = this.engine.getState('__sys_items');
        if (Array.isArray(itemIds)) {
            this.engine.items.deserialize(itemIds);
        }

        const bgUrl = this.engine.getState('__sys_bg');
        if (bgUrl) await this.engine.runCommand({ type: 'background', assetUrl: bgUrl });

        const bgmUrl = this.engine.getState('__sys_bgm');
        if (bgmUrl) await this.engine.runCommand({ type: 'bgm', action: 'play', assetUrl: bgmUrl });

        const sprites = this.engine.getState('__sys_sprites');
        if (sprites && typeof sprites === 'object') {
            for (const [id, data] of Object.entries(sprites)) {
                const s = data as any;
                await this.engine.runCommand({
                    type: 'sprite',
                    id,
                    action: 'show',
                    assetUrl: s.assetUrl,
                    x: s.x,
                    y: s.y,
                    anchorX: s.anchorX,
                    anchorY: s.anchorY,
                    scaleX: s.scaleX,
                    scaleY: s.scaleY,
                    flip: s.flip,
                    transition: 'instant',
                });
            }
        }

        await this.engine.jumpToScene(saveData.sceneName, saveData.index);
    }

    public getMeta(slot: number): SaveMeta | null {
        const saveStr = localStorage.getItem(`${this.prefix}_${slot}`);
        if (!saveStr) return null;

        try {
            const saveData: SaveState = JSON.parse(saveStr);
            return saveData.meta ?? {
                slot,
                savedAt: 0,
                sceneName: saveData.sceneName
            };
        } catch {
            return null;
        }
    }

    public listSlots(maxSlots: number = 10): (SaveMeta | null)[] {
        const slots: (SaveMeta | null)[] = [];
        for (let i = 1; i <= maxSlots; i++) {
            slots.push(this.getMeta(i));
        }
        return slots;
    }

    public hasSlot(slot: number): boolean {
        return localStorage.getItem(`${this.prefix}_${slot}`) !== null;
    }

    public deleteSlot(slot: number) {
        localStorage.removeItem(`${this.prefix}_${slot}`);
        this.engine.logger.info(`Save slot ${slot} deleted`);
    }
}
import type { Engine } from '../Engine';
import type { SpriteState } from '../handlers/SpriteHandler';

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
    state: Record<string, unknown>;
}

export class SaveManager {
    private engine: Engine;
    private prefix: string;

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

        try {
            const saveData = JSON.parse(saveString) as SaveState;
            return saveData.meta ?? {
                savedAt: 0,
                sceneName: saveData.sceneName,
                slot
            };
        } catch {
            return undefined;
        }
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

        const saveData = JSON.parse(saveString) as SaveState;
        this.engine.logger.info(`Loading save from slot ${slot}...`);

        this.engine.clear();

        this.engine.state = saveData.state;
        const itemIds = this.engine.getState<unknown>('__sys_items');
        if (Array.isArray(itemIds)) {
            this.engine.items.deserialize(itemIds as string[]);
        }

        const bgUrl = this.engine.getState<string | undefined>('__sys_bg');
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
}
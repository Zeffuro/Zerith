import type { Engine } from '../Engine';

export interface SaveState {
    sceneName: string;
    index: number;
    state: Record<string, any>;
}

export class SaveManager {
    private engine: Engine;

    constructor(engine: Engine) {
        this.engine = engine;
    }

    public save(slot: number = 1) {
        const saveData: SaveState = {
            sceneName: this.engine.currentSceneName,
            index: Math.max(0, this.engine.currentIndex - 1),
            state: JSON.parse(JSON.stringify(this.engine.state))
        };

        localStorage.setItem(`zerith_save_${slot}`, JSON.stringify(saveData));
        this.engine.logger.info(`Game saved to slot ${slot}`);
    }

    public async load(slot: number = 1) {
        const saveStr = localStorage.getItem(`zerith_save_${slot}`);
        if (!saveStr) {
            this.engine.logger.warn(`No save found in slot ${slot}`);
            return;
        }

        const saveData: SaveState = JSON.parse(saveStr);
        this.engine.logger.info(`Loading save from slot ${slot}...`);

        this.engine.clear();

        this.engine.state = saveData.state;

        const bgUrl = this.engine.getState('__sys_bg');
        if (bgUrl) await this.engine.runCommand({ type: 'background', assetUrl: bgUrl });

        const bgmUrl = this.engine.getState('__sys_bgm');
        if (bgmUrl) await this.engine.runCommand({ type: 'bgm', action: 'play', assetUrl: bgmUrl });

        await this.engine.jumpToScene(saveData.sceneName, saveData.index);
    }
}
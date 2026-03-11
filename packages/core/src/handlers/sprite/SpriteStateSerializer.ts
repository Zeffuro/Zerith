import type { IStateManager } from '../../interfaces/managers';
import type { SaveState } from '../../managers/SaveManager';
import type { SpriteCommand, SpriteState } from './types';

type SpriteCommandExecutor = (command: SpriteCommand) => Promise<void>;

export class SpriteStateSerializer {
    private readonly executeSpriteCommand: SpriteCommandExecutor;
    private readonly state: IStateManager;

    constructor(state: IStateManager, executeSpriteCommand: SpriteCommandExecutor) {
        this.state = state;
        this.executeSpriteCommand = executeSpriteCommand;
    }

    public readonly handleStateLoaded = (saveData: SaveState): void => {
        for (const [id, sprite] of Object.entries(saveData.system.sprites)) {
            void this.executeSpriteCommand({
                action: 'show',
                anchorX: sprite.anchorX,
                anchorY: sprite.anchorY,
                assetUrl: sprite.assetUrl,
                flip: sprite.flip,
                id,
                pose: sprite.pose,
                scaleX: sprite.scaleX,
                scaleY: sprite.scaleY,
                transition: 'instant',
                type: 'sprite',
                x: sprite.x,
                y: sprite.y,
            }).then(async () => {
                if (!sprite.animation) {
                    return;
                }

                await this.executeSpriteCommand({
                    action: 'animate',
                    animation: sprite.animation,
                    id,
                    type: 'sprite',
                });
            });
        }
    };

    public removeSprite(id: string): void {
        delete this.state.system.sprites[id];
    }

    public saveAnimation(id: string, animation: string): void {
        const sprite = this.state.system.sprites[id];
        if (!sprite) {
            return;
        }

        sprite.animation = animation;
    }

    public saveMove(id: string, x: number, y: number): void {
        const sprite = this.state.system.sprites[id];
        if (!sprite) {
            return;
        }

        sprite.x = x;
        sprite.y = y;
    }

    public savePose(id: string, command: Pick<SpriteCommand, 'assetUrl' | 'pose'>): void {
        const sprite = this.state.system.sprites[id];
        if (!sprite) {
            return;
        }

        sprite.assetUrl = command.assetUrl;
        sprite.pose = command.pose;
        sprite.animation = undefined;
    }

    public saveShownSprite(id: string, spriteState: SpriteState): void {
        this.state.system.sprites[id] = spriteState;
    }
}


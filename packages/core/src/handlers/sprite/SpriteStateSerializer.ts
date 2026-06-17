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
                fit: sprite.fit,
                flip: sprite.flip,
                heightRatio: sprite.heightRatio,
                id,
                pose: sprite.pose,
                scaleX: hasRatioSize(sprite) ? undefined : sprite.scaleX,
                scaleY: hasRatioSize(sprite) ? undefined : sprite.scaleY,
                transition: 'instant',
                type: 'sprite',
                widthRatio: sprite.widthRatio,
                x: sprite.xRatio === undefined ? sprite.x : undefined,
                xRatio: sprite.xRatio,
                y: sprite.yRatio === undefined ? sprite.y : undefined,
                yRatio: sprite.yRatio,
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

    public saveMove(
        id: string,
        position: {
            clearXRatio?: boolean;
            clearYRatio?: boolean;
        } & Pick<SpriteState, 'x' | 'xRatio' | 'y' | 'yRatio'>,
    ): void {
        const sprite = this.state.system.sprites[id];
        if (!sprite) {
            return;
        }

        sprite.x = position.x;
        sprite.y = position.y;
        sprite.xRatio = position.xRatio ?? (position.clearXRatio ? undefined : sprite.xRatio);
        sprite.yRatio = position.yRatio ?? (position.clearYRatio ? undefined : sprite.yRatio);
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

function hasRatioSize(sprite: SpriteState): boolean {
    return sprite.widthRatio !== undefined || sprite.heightRatio !== undefined;
}


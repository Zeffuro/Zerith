import type { IFlowManager } from '../interfaces/managers';
import type { BaseCommand, CommandHandler } from '../types';

export interface SceneChangeCommand extends BaseCommand {
    assetUrl: string;
    duration?: number;
    type: 'scene_change';
}

export class SceneChangeHandler implements CommandHandler<SceneChangeCommand> {
    public autoNext = true;
    public type = 'scene_change' as const;
    private readonly flow: IFlowManager;

    constructor(flow: IFlowManager) {
        this.flow = flow;
    }

    execute = async (command: SceneChangeCommand) => {
        const fadeTime = (command.duration || 1000) / 2;

        await this.flow.runCommand({
            action: 'fade_out',
            duration: fadeTime,
            type: 'transition'
        });

        await this.flow.runCommand({
            assetUrl: command.assetUrl,
            type: 'background'
        });

        await this.flow.runCommand({
            action: 'fade_in',
            duration: fadeTime,
            type: 'transition'
        });
    };
}
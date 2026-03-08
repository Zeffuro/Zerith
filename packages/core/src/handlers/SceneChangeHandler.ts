import type { BaseCommand, CommandHandler } from '../types';
import type { Engine } from '../Engine';

export interface SceneChangeCommand extends BaseCommand {
    type: 'scene_change';
    assetUrl: string;
    duration?: number;
}

export class SceneChangeHandler implements CommandHandler<SceneChangeCommand> {
    public type: 'scene_change' = 'scene_change';
    public autoNext = true;

    execute = async (command: SceneChangeCommand, engine: Engine) => {
        const fadeTime = (command.duration || 1000) / 2;

        await engine.runCommand({
            type: 'transition',
            action: 'fade_out',
            duration: fadeTime
        });

        await engine.runCommand({
            type: 'background',
            assetUrl: command.assetUrl
        });

        await engine.runCommand({
            type: 'transition',
            action: 'fade_in',
            duration: fadeTime
        });
    };
}
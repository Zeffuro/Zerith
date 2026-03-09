import type { ContextWithFlow } from '../execution/ExecutionContext';
import type { BaseCommand, CommandHandler } from '../types';

export interface SceneChangeCommand extends BaseCommand {
    assetUrl: string;
    duration?: number;
    type: 'scene_change';
}

export class SceneChangeHandler implements CommandHandler<SceneChangeCommand, ContextWithFlow> {
    public autoNext = true;
    public type = 'scene_change' as const;

    execute = async (command: SceneChangeCommand, engine: ContextWithFlow) => {
        const fadeTime = (command.duration || 1000) / 2;

        await engine.runCommand({
            action: 'fade_out',
            duration: fadeTime,
            type: 'transition'
        });

        await engine.runCommand({
            assetUrl: command.assetUrl,
            type: 'background'
        });

        await engine.runCommand({
            action: 'fade_in',
            duration: fadeTime,
            type: 'transition'
        });
    };
}
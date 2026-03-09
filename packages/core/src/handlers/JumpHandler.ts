import type { SceneInjectionContext } from '../execution/ExecutionContext';
import type { BaseCommand, CommandHandler } from '../types';

export interface JumpCommand extends BaseCommand {
    to: string;
    type: 'jump';
}

export class JumpHandler implements CommandHandler<JumpCommand, SceneInjectionContext> {
    public autoNext = true;
    public type = 'jump' as const;

    execute = async (command: JumpCommand, engine: SceneInjectionContext) => {
        await engine.getSystem('scenes').jumpToScene(command.to);
    };
}
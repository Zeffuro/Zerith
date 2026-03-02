import type { BaseCommand, CommandHandler } from '../types';
import type { Engine } from '../Engine';

export interface IfCommand extends BaseCommand {
    type: 'if';
    key: string;
    value?: any;
    then?: BaseCommand[];
    else?: BaseCommand[];
}

export class IfHandler implements CommandHandler<IfCommand> {
    public type = 'if';
    public autoNext = true;

    execute = async (command: IfCommand, engine: Engine) => {
        const actualValue = engine.getState(command.key);

        const conditionMet = command.value !== undefined
            ? actualValue === command.value
            : !!actualValue;

        if (conditionMet && command.then) {
            engine.injectCommands(command.then);
        } else if (!conditionMet && command.else) {
            engine.injectCommands(command.else);
        }
    };
}
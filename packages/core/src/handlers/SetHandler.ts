import type { BaseCommand, CommandHandler } from '../types';
import type { Engine } from '../Engine';

export interface SetCommand extends BaseCommand {
    type: 'set';
    key: string;
    value: any;
}

export class SetHandler implements CommandHandler<SetCommand> {
    public type = 'set';
    public autoNext = true;

    execute = async (command: SetCommand, engine: Engine) => {
        engine.setState(command.key, command.value);
    };
}
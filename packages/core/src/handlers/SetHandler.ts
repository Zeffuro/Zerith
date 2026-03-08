import type { BaseCommand, CommandHandler } from '../types';
import type { Engine } from '../Engine';

export interface SetCommand extends BaseCommand {
    type: 'set';
    key: string;
    value?: any;
    op?: 'set' | 'add' | 'sub' | 'toggle';
}

export class SetHandler implements CommandHandler<SetCommand> {
    public type: 'set' = 'set';
    public autoNext = true;

    execute = async (command: SetCommand, engine: Engine) => {
        const current = engine.getState(command.key);

        switch (command.op ?? 'set') {
            case 'set':
                engine.setState(command.key, command.value);
                break;
            case 'add':
                engine.setState(command.key, (current ?? 0) + (command.value ?? 1));
                break;
            case 'sub':
                engine.setState(command.key, (current ?? 0) - (command.value ?? 1));
                break;
            case 'toggle':
                engine.setState(command.key, !current);
                break;
        }
    };
}
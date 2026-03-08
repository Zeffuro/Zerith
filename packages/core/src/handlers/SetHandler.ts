import type { Engine } from '../Engine';
import type { BaseCommand, CommandHandler } from '../types';

export interface SetCommand extends BaseCommand {
    key: string;
    op?: 'add' | 'set' | 'sub' | 'toggle';
    type: 'set';
    value?: any;
}

export class SetHandler implements CommandHandler<SetCommand> {
    public autoNext = true;
    public type: 'set' = 'set';

    execute = async (command: SetCommand, engine: Engine) => {
        const current = engine.getState(command.key);

        switch (command.op ?? 'set') {
            case 'add': {
                engine.setState(command.key, (current ?? 0) + (command.value ?? 1));
                break;
            }
            case 'set': {
                engine.setState(command.key, command.value);
                break;
            }
            case 'sub': {
                engine.setState(command.key, (current ?? 0) - (command.value ?? 1));
                break;
            }
            case 'toggle': {
                engine.setState(command.key, !current);
                break;
            }
        }
    };
}
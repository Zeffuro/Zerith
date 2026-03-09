import type { IStateManager } from '../interfaces/managers';
import type { BaseCommand, CommandHandler } from '../types';

export interface SetCommand extends BaseCommand {
    key: string;
    op?: 'add' | 'set' | 'sub' | 'toggle';
    type: 'set';
    value?: unknown;
}

export class SetHandler implements CommandHandler<SetCommand> {
    public autoNext = true;
    public type = 'set' as const;
    private readonly state: IStateManager;

    constructor(state: IStateManager) {
        this.state = state;
    }

    execute = (command: SetCommand) => {
        const current = this.state.get(command.key);

        switch (command.op ?? 'set') {
            case 'add': {
                this.state.set(command.key, ((current as number | undefined) ?? 0) + ((command.value as number | undefined) ?? 1));
                break;
            }
            case 'set': {
                this.state.set(command.key, command.value);
                break;
            }
            case 'sub': {
                this.state.set(command.key, ((current as number | undefined) ?? 0) - ((command.value as number | undefined) ?? 1));
                break;
            }
            case 'toggle': {
                this.state.set(command.key, !current);
                break;
            }
        }
        return Promise.resolve();
    };
}
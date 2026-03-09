import type { IEvidenceManager } from '../interfaces/managers';
import type { BaseCommand, CommandHandler } from '../types';

export interface ItemCommand extends BaseCommand {
    action: 'add' | 'remove' | 'update';
    changes?: Record<string, unknown>;
    id: string;
    type: 'item';
}

export class ItemHandler implements CommandHandler<ItemCommand> {
    public autoNext = true;
    public type = 'item' as const;
    private readonly manager: IEvidenceManager;

    constructor(manager: IEvidenceManager) {
        this.manager = manager;
    }

    execute = (command: ItemCommand) => {
        switch (command.action) {
            case 'add': {
                this.manager.add(command.id);
                break;
            }
            case 'remove': {
                this.manager.remove(command.id);
                break;
            }
            case 'update': {
                if (command.changes) {
                    this.manager.update(command.id, command.changes);
                }
                break;
            }
            default: { break;
            }
        }
        return Promise.resolve();
    };
}
import type { Engine } from '../Engine';
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

    execute = (command: ItemCommand, engine: Engine) => {
        const manager = engine.items;

        switch (command.action) {
            case 'add': {
                manager.add(command.id);
                break;
            }
            case 'remove': {
                manager.remove(command.id);
                break;
            }
            case 'update': {
                if (command.changes) {
                    manager.update(command.id, command.changes);
                }
                break;
            }
            default: { break;
            }
        }
        return Promise.resolve();
    };
}
import type { ContextWithItems } from '../execution/ExecutionContext';
import type { BaseCommand, CommandHandler } from '../types';

export interface ItemCommand extends BaseCommand {
    action: 'add' | 'remove' | 'update';
    changes?: Record<string, unknown>;
    id: string;
    type: 'item';
}

export class ItemHandler implements CommandHandler<ItemCommand, ContextWithItems> {
    public autoNext = true;
    public type = 'item' as const;

    execute = (command: ItemCommand, engine: ContextWithItems) => {
        const manager = engine.getSystem('items');

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
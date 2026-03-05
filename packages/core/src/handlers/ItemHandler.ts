import type { BaseCommand, CommandHandler } from '../types';
import type { Engine } from '../Engine';

export interface ItemCommand extends BaseCommand {
    type: 'item';
    action: 'add' | 'remove' | 'update';
    manager?: string;
    id: string;
    changes?: Record<string, any>;
}

export class ItemHandler implements CommandHandler<ItemCommand> {
    public type = 'item';
    public autoNext = true;

    execute = async (command: ItemCommand, engine: Engine) => {
        const manager = command.manager === 'evidence' || !command.manager
            ? engine.evidence
            : engine.evidence; // TODO: Make a more generic version later

        switch (command.action) {
            case 'add':
                manager.add(command.id);
                engine.logger.info(`Item added: ${command.id}`);
                break;
            case 'remove':
                manager.remove(command.id);
                engine.logger.info(`Item removed: ${command.id}`);
                break;
            case 'update':
                if (command.changes) {
                    manager.update(command.id, command.changes);
                    engine.logger.info(`Item updated: ${command.id}`);
                }
                break;
        }

        engine.setState('__sys_items', manager.serialize());
    };
}
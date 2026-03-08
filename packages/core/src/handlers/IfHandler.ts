import type { Engine } from '../Engine';
import type { BaseCommand, CommandHandler } from '../types';

export type ComparisonOp = 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'neq';

export interface Condition {
    key: string;
    op?: ComparisonOp;
    source?: string;
    value?: any;
}

export interface IfCommand extends BaseCommand {
    all?: Condition[];
    any?: Condition[];
    else?: BaseCommand[];
    key?: string;
    op?: ComparisonOp;
    source?: string;
    then?: BaseCommand[];
    type: 'if';
    value?: any;
}

export class IfHandler implements CommandHandler<IfCommand> {
    public autoNext = true;
    public type: 'if' = 'if';

    execute = async (command: IfCommand, engine: Engine) => {
        let conditionMet: boolean;

        if (command.all) {
            conditionMet = command.all.every(c => this.evaluate(c, engine));
        } else if (command.any) {
            conditionMet = command.any.some(c => this.evaluate(c, engine));
        } else {
            conditionMet = this.evaluate(
                { key: command.key!, op: command.op, source: command.source, value: command.value },
                engine
            );
        }

        if (conditionMet && command.then) {
            engine.scenes.injectCommands(command.then);
        } else if (!conditionMet && command.else) {
            engine.scenes.injectCommands(command.else);
        }
    };

    private evaluate(condition: Condition, engine: Engine): boolean {
        if (condition.source === 'items' || condition.source === 'evidence') {
            const hasItem = engine.items.has(condition.key);
            if (condition.value === undefined) return hasItem;
            return condition.op === 'neq' ? hasItem !== condition.value : hasItem === condition.value;
        }

        const actual = engine.getState(condition.key);
        const op = condition.op ?? 'eq';

        if (condition.value === undefined) {
            return !!actual;
        }

        switch (op) {
            case 'eq': { return actual === condition.value;
            }
            case 'gt': { return actual > condition.value;
            }
            case 'gte': { return actual >= condition.value;
            }
            case 'lt': { return actual < condition.value;
            }
            case 'lte': { return actual <= condition.value;
            }
            case 'neq': { return actual !== condition.value;
            }
            default: { return actual === condition.value;
            }
        }
    }
}
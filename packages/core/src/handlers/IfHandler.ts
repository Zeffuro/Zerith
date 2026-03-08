import type { Engine } from '../Engine';
import type { BaseCommand, CommandHandler } from '../types';

export type ComparisonOp = 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'neq';

export interface Condition {
    key: string;
    op?: ComparisonOp;
    source?: string;
    value?: unknown;
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
    value?: unknown;
}

export class IfHandler implements CommandHandler<IfCommand> {
    public autoNext = true;
    public type = 'if' as const;

    execute = (command: IfCommand, engine: Engine) => {
        let conditionMet: boolean;

        if (command.all) {
            conditionMet = command.all.every(c => this.evaluate(
                { key: c.key, op: c.op, source: c.source, value: c.value },
                engine
            ));
        } else if (command.any) {
            conditionMet = command.any.some(c => this.evaluate(
                { key: c.key, op: c.op, source: c.source, value: c.value },
                engine
            ));
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
        return Promise.resolve();
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
            case 'gt': { return (actual as number | string) > (condition.value as number | string);
            }
            case 'gte': { return (actual as number | string) >= (condition.value as number | string);
            }
            case 'lt': { return (actual as number | string) < (condition.value as number | string);
            }
            case 'lte': { return (actual as number | string) <= (condition.value as number | string);
            }
            case 'neq': { return actual !== condition.value;
            }
            default: { return actual === condition.value;
            }
        }
    }
}
import type { BaseCommand, CommandHandler } from '../types';
import type { Engine } from '../Engine';

export type ComparisonOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';

export interface Condition {
    key: string;
    op?: ComparisonOp;
    value?: any;
}

export interface IfCommand extends BaseCommand {
    type: 'if';
    key?: string;
    op?: ComparisonOp;
    value?: any;
    all?: Condition[];
    any?: Condition[];
    then?: BaseCommand[];
    else?: BaseCommand[];
}

export class IfHandler implements CommandHandler<IfCommand> {
    public type = 'if';
    public autoNext = true;

    execute = async (command: IfCommand, engine: Engine) => {
        let conditionMet: boolean;

        if (command.all) {
            conditionMet = command.all.every(c => this.evaluate(c, engine));
        } else if (command.any) {
            conditionMet = command.any.some(c => this.evaluate(c, engine));
        } else {
            conditionMet = this.evaluate(
                { key: command.key!, op: command.op, value: command.value },
                engine
            );
        }

        if (conditionMet && command.then) {
            engine.injectCommands(command.then);
        } else if (!conditionMet && command.else) {
            engine.injectCommands(command.else);
        }
    };

    private evaluate(condition: Condition, engine: Engine): boolean {
        const actual = engine.getState(condition.key);
        const op = condition.op ?? 'eq';

        if (condition.value === undefined) {
            return !!actual;
        }

        switch (op) {
            case 'eq': return actual === condition.value;
            case 'neq': return actual !== condition.value;
            case 'gt': return actual > condition.value;
            case 'gte': return actual >= condition.value;
            case 'lt': return actual < condition.value;
            case 'lte': return actual <= condition.value;
            default: return actual === condition.value;
        }
    }
}
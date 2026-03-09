import type { SceneConditionalContext } from '../execution/ExecutionContext';
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
    key?: string;
    onFalse?: BaseCommand[];
    onTrue?: BaseCommand[];
    op?: ComparisonOp;
    source?: string;
    type: 'if';
    value?: unknown;
}

export class IfHandler implements CommandHandler<IfCommand, SceneConditionalContext> {
    public autoNext = true;
    public type = 'if' as const;

    execute = (command: IfCommand, engine: SceneConditionalContext) => {
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

        const scenes = engine.getSystem('scenes');
        if (conditionMet && command.onTrue) {
            scenes.injectCommands(command.onTrue);
        } else if (!conditionMet && command.onFalse) {
            scenes.injectCommands(command.onFalse);
        }
        return Promise.resolve();
    };

    private evaluate(condition: Condition, engine: SceneConditionalContext): boolean {
        if (condition.source === 'items' || condition.source === 'evidence') {
            const hasItem = engine.getSystem('items').has(condition.key);
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
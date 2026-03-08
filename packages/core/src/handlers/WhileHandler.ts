import type { Engine } from '../Engine';
import type { BaseCommand, CommandHandler } from '../types';

export interface WhileCommand extends BaseCommand {
    all?: WhileCondition[];
    any?: WhileCondition[];
    body?: BaseCommand[];
    key?: string;
    maxIterations?: number;
    op?: 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'neq';
    source?: string;
    type: 'while';
    value?: unknown;
}

export interface WhileCondition {
    key: string;
    op?: 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'neq';
    source?: string;
    value?: unknown;
}

export class WhileHandler implements CommandHandler<WhileCommand> {
    public autoNext = true;
    public type = 'while' as const;

    execute = async (command: WhileCommand, engine: Engine) => {
        const body = Array.isArray(command.body) ? command.body : [];
        const maxIterations = Number.isFinite(command.maxIterations as number)
            ? Math.max(1, Number(command.maxIterations))
            : 10_000;

        let count = 0;
        while (this.evaluateCommand(command, engine)) {
            for (const child of body) {
                await engine.runCommand(child);
            }
            count++;
            if (count >= maxIterations) {
                engine.logger.warn(`[while] maxIterations reached (${maxIterations}); breaking loop.`);
                break;
            }
        }
    };

    private evaluateCommand(command: WhileCommand, engine: Engine): boolean {
        if (Array.isArray(command.all)) return command.all.every(c => this.evaluateCondition(c, engine));
        if (Array.isArray(command.any)) return command.any.some(c => this.evaluateCondition(c, engine));
        if (!command.key) return false;
        return this.evaluateCondition(
            { key: command.key, op: command.op, source: command.source, value: command.value },
            engine
        );
    }

    private evaluateCondition(
        condition: WhileCondition,
        engine: Engine
    ): boolean {
        if (condition.source === 'items' || condition.source === 'evidence') {
            const hasItem = engine.items.has(condition.key);
            if (condition.value === undefined) return hasItem;
            return condition.op === 'neq' ? hasItem !== condition.value : hasItem === condition.value;
        }

        const actual = engine.getState(condition.key);
        const op = condition.op ?? 'eq';

        if (condition.value === undefined) return !!actual;

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
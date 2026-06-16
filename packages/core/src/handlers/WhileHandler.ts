import type { IEvidenceManager, IFlowManager, IStateManager } from '../interfaces/managers';
import type { BaseCommand, CommandHandler } from '../types';
import type { Logger } from '../utils/Logger';

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
    private readonly flow: IFlowManager;
    private readonly items: IEvidenceManager;
    private readonly logger: Logger;
    private readonly state: IStateManager;

    constructor(
        flow: IFlowManager,
        logger: Logger,
        items: IEvidenceManager,
        state: IStateManager,
    ) {
        this.flow = flow;
        this.logger = logger;
        this.items = items;
        this.state = state;
    }

    execute = (command: WhileCommand) => {
        const body = Array.isArray(command.body) ? command.body : [];
        const maxIterations = Number.isFinite(command.maxIterations)
            ? Math.max(1, Number(command.maxIterations))
            : 10_000;

        if (!this.evaluateCommand(command)) {
            return;
        }

        if (maxIterations <= 1) {
            this.logger.warn(`[while] maxIterations reached (${maxIterations}); breaking loop.`);
            this.flow.injectCommands(body);
            return;
        }

        this.flow.injectCommands([
            ...body,
            {
                ...command,
                maxIterations: maxIterations - 1,
            },
        ]);
    };

    private evaluateCommand(command: WhileCommand): boolean {
        if (Array.isArray(command.all)) return command.all.every(c => this.evaluateCondition(c));
        if (Array.isArray(command.any)) return command.any.some(c => this.evaluateCondition(c));
        if (!command.key) return false;
        return this.evaluateCondition(
            { key: command.key, op: command.op, source: command.source, value: command.value },
        );
    }

    private evaluateCondition(condition: WhileCondition): boolean {
        if (condition.source === 'items' || condition.source === 'evidence') {
            const hasItem = this.items.has(condition.key);
            if (condition.value === undefined) return hasItem;
            return condition.op === 'neq' ? hasItem !== condition.value : hasItem === condition.value;
        }

        const actual = this.state.get(condition.key);
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

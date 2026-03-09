import type { CommandExecutionContext, ExecutionContext } from '../execution/ExecutionContext';
import type { BaseCommand, CommandType } from '../types/Commands';

export type CommandHandlerConstructor =
    new (...arguments_: unknown[]) => RegisteredCommandHandler;

export type CommandHandlerProvider =
    | CommandHandlerConstructor
    | RegisteredCommandHandler;

export type CommandHandlerRegistry = Map<CommandType, RegisteredCommandHandler>;

export interface ICommandHandler<
    T extends BaseCommand = BaseCommand,
    C = ExecutionContext,
> {
    autoNext?: boolean;
    destroy?(): Promise<void> | void;
    execute(command: T, context: C): Promise<void> | void;
    init?(context: C): Promise<void> | void;
    reset?(): void;
    type: T['type'];
}

export type RegisteredCommandHandler = ICommandHandler<BaseCommand, CommandExecutionContext>;



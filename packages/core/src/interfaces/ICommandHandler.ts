import type { Engine } from '../Engine';
import type { BaseCommand, CommandType } from '../types/Commands';

export interface ICommandHandler<T extends BaseCommand = BaseCommand> {
    type: T['type'];
    autoNext?: boolean;
    init?(engine: Engine): void | Promise<void>;
    execute(command: T, engine: Engine): void | Promise<void>;
    reset?(): void;
    destroy?(): void | Promise<void>;
}

export type RegisteredCommandHandler = ICommandHandler<BaseCommand>;

export type CommandHandlerRegistry = Map<CommandType, RegisteredCommandHandler>;

export type CommandHandlerConstructor =
    new (...arguments_: unknown[]) => RegisteredCommandHandler;

export type CommandHandlerProvider =
    | RegisteredCommandHandler
    | CommandHandlerConstructor;



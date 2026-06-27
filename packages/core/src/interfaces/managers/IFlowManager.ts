import type { BaseCommand } from '../../types';
import type { RegisteredCommandHandler } from '../ICommandHandler';
import type { IBaseManager } from './IBaseManager';

export interface IFlowManager extends IBaseManager {
    consumeSkip(): boolean;
    destroyHandlers(): void;
    getHandler(type: BaseCommand['type']): RegisteredCommandHandler | undefined;
    injectCommands(commands: BaseCommand[]): void;
    readonly isPaused: boolean;
    readonly isStarted: boolean;
    readonly lastSavePoint: number;
    pause(): void;
    playNext(): Promise<void>;
    registerHandler(handler: RegisteredCommandHandler): void;
    registerHandlers(handlers: RegisteredCommandHandler[]): void;
    requestSkip(): void;
    reset(): void;
    resetHandlers(): void;
    resume(): void;
    runCommand(command: BaseCommand): Promise<void>;
    start(): void;
    step(): void;
    stop(): void;
    unregisterHandler(type: BaseCommand['type']): void;
}


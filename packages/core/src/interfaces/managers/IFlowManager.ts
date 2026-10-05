import type { FlowContinuation } from '../../managers/flowContinuation';
import type { BaseCommand } from '../../types';
import type { RegisteredCommandHandler } from '../ICommandHandler';
import type { IBaseManager } from './IBaseManager';

export interface IFlowManager extends IBaseManager {
    acquireSuspension?(): () => void;
    captureSaveContinuation?(): FlowContinuation;
    completePresentation?(kind: 'choice'): void;
    consumeSkip(): boolean;
    destroyHandlers(): void;
    getHandler(type: BaseCommand['type']): RegisteredCommandHandler | undefined;
    injectCommands(commands: BaseCommand[]): void;
    readonly isBusy?: boolean;
    readonly isPaused: boolean;
    readonly isRestoringPresentation?: boolean;
    readonly isStarted: boolean;
    readonly lastSavePoint: number;
    pause(): void;
    playNext(): Promise<void>;
    registerHandler(handler: RegisteredCommandHandler): void;
    registerHandlers(handlers: RegisteredCommandHandler[]): void;
    requestAutomaticContinuation?(handler: RegisteredCommandHandler): Promise<void>;
    requestSkip(): void;
    reset(): void;
    resetHandlers(): void;
    restoreSaveContinuation?(continuation: FlowContinuation): void;
    resume(): void;
    runCommand(command: BaseCommand): Promise<void>;
    start(): void;
    step(): void;
    stop(): void;
    // With destroy:false, only detach the registry entry.
    unregisterHandler(type: BaseCommand['type'], options?: { destroy?: boolean }): Promise<void> | void;
}


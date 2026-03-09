import type { BaseCommand } from '../../types';
import type { IBaseManager } from './IBaseManager';

export interface IFlowManager extends IBaseManager {
    consumeSkip(): boolean;
    injectCommands(commands: BaseCommand[]): void;
    readonly isStarted: boolean;
    readonly lastSavePoint: number;
    playNext(): Promise<void>;
    requestSkip(): void;
    reset(): void;
    runCommand(command: BaseCommand): Promise<void>;
    start(): void;
    stop(): void;
}


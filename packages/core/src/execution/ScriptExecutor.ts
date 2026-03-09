import type { EngineConfig } from '../EngineConfig';
import type { CommandHandlerRegistry } from '../interfaces/ICommandHandler';
import type { IEventBus, ISceneManager } from '../interfaces/managers';
import type { BaseCommand } from '../types';
import type { Logger } from '../utils/Logger';

import {
    type CommandExecutionContext,
    HandlerExecutionContext,
    type HandlerRuntime,
    type SystemRegistry,
} from './ExecutionContext';

export interface ScriptExecutorDeps {
    events: IEventBus;
    handlers: CommandHandlerRegistry;
    logger: Logger;
    onSceneNavigation?: EngineConfig['onSceneNavigation'];
    runtime: HandlerRuntime;
    scenes: ISceneManager;
    systems: SystemRegistry;
}

export class ScriptExecutor {
    public get isStarted(): boolean {
        return this.started;
    }

    public get lastSavePoint(): number {
        return this._lastSavePoint;
    }

    private _lastSavePoint = 0;
    private readonly context: CommandExecutionContext;
    private readonly events: IEventBus;
    private readonly handlers: CommandHandlerRegistry;
    private injectedCommands: BaseCommand[] = [];

    private isExecuting = false;
    private readonly logger: Logger;
    private readonly onSceneNavigation?: EngineConfig['onSceneNavigation'];
    private readonly scenes: ISceneManager;
    private skipRequested = false;
    private started = false;

    constructor(deps: ScriptExecutorDeps) {
        this.context = new HandlerExecutionContext(deps.systems, deps.runtime);
        this.events = deps.events;
        this.handlers = deps.handlers;
        this.logger = deps.logger;
        this.onSceneNavigation = deps.onSceneNavigation;
        this.scenes = deps.scenes;
    }

    public consumeSkip(): boolean {
        if (this.skipRequested) {
            this.skipRequested = false;
            return true;
        }
        return false;
    }

    public getContext(): CommandExecutionContext {
        return this.context;
    }

    public injectCommands(commands: BaseCommand[]) {
        if (commands.length === 0) return;
        this.injectedCommands = [...commands, ...this.injectedCommands];
    }

    public async playNext() {
        if (this.isExecuting || !this.started) return;
        this.isExecuting = true;

        try {
            while (this.injectedCommands.length > 0 || this.scenes.currentIndex < this.scenes.scriptLength) {
                const hasInjected = this.injectedCommands.length > 0;
                const index = this.scenes.currentIndex;
                const command = hasInjected
                    ? this.injectedCommands.shift()
                    : this.scenes.getCommandAt(this.scenes.currentIndex++);

                if (!command) continue;
                await this.runCommand(command);

                if (this.shouldSkipSceneNavigation(command)) {
                    return;
                }

                const handler = this.handlers.get(command.type);
                if (handler && !handler.autoNext && !hasInjected) {
                    this._lastSavePoint = this.scenes.getLastOriginalIndex(index);
                    this.isExecuting = false;
                    return;
                }
            }
        } catch (error) {
            const index = this.scenes.currentIndex - 1;
            const command = this.scenes.getCommandAt(index);
            const type = command ? command.type : 'unknown';
            this.logger.error(
                `Error executing command at index ${index} (type: '${type}'): ${String(error)}`
            );
        } finally {
            this.isExecuting = false;
        }
    }

    public requestSkip() {
        if (this.isExecuting) {
            this.skipRequested = true;
        }
    }

    public reset() {
        this.injectedCommands = [];
        this.isExecuting = false;
        this.skipRequested = false;
    }

    public async runCommand(command: BaseCommand) {
        const handler = this.handlers.get(command.type);
        if (!handler) {
            this.logger.warn(`No handler registered for command type '${command.type}'`);
            return;
        }

        try {
            await handler.execute(command, this.context);
            this.events.emit('script:command_executed', command.type);
        } catch (error) {
            this.logger.error(
                `Handler '${command.type}' threw during execute: ${String(error)}`
            );
        }
    }

    public start() {
        this.started = true;
        void this.playNext();
    }

    public stop() {
        this.started = false;
        this.reset();
    }

    private shouldSkipSceneNavigation(command: BaseCommand): boolean {
        if (command.type === 'jump') {
            const sceneName =
                'to' in command && typeof command.to === 'string'
                    ? command.to
                    : '';
            const action = this.onSceneNavigation?.(sceneName, 'jump');
            if (action === 'skip') {
                this.logger.info(`[Engine] Skipping scene navigation to '${sceneName}'`);
                return true;
            }
            return false;
        }

        if (command.type === 'scene_change') {
            const sceneName =
                'assetUrl' in command && typeof command.assetUrl === 'string'
                    ? command.assetUrl
                    : '';
            const action = this.onSceneNavigation?.(sceneName, 'scene_change');
            if (action === 'skip') {
                this.logger.info(`[Engine] Skipping scene navigation to '${sceneName}'`);
                return true;
            }
            return false;
        }

        return false;
    }
}

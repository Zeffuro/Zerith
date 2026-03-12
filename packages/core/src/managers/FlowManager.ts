import type { EngineConfig } from '../EngineConfig';
import type { CommandHandlerRegistry, RegisteredCommandHandler } from '../interfaces/ICommandHandler';
import type { IEventBus, IFlowManager, ISceneManager } from '../interfaces/managers';
import type { BaseCommand } from '../types';
import type { Logger } from '../utils/Logger';

export interface FlowManagerDeps {
    events: IEventBus;
    handlers: CommandHandlerRegistry;
    logger: Logger;
    onSceneNavigation?: EngineConfig['onSceneNavigation'];
    scenes: ISceneManager;
}

export class FlowManager implements IFlowManager {
    public get isPaused(): boolean {
        return this.paused;
    }

    public get isStarted(): boolean {
        return this.started;
    }

    public get lastSavePoint(): number {
        return this._lastSavePoint;
    }

    private _lastSavePoint = 0;
    private destroyed = false;
    private readonly events: IEventBus;
    private readonly handlers: CommandHandlerRegistry;
    private injectedCommands: BaseCommand[] = [];
    private isExecuting = false;
    private readonly logger: Logger;
    private readonly onSceneNavigation?: EngineConfig['onSceneNavigation'];
    private paused = false;
    private readonly scenes: ISceneManager;
    private skipRequested = false;
    private started = false;
    private stepRemaining = 0;

    constructor(deps: FlowManagerDeps) {
        this.events = deps.events;
        this.handlers = deps.handlers;
        this.logger = deps.logger;
        this.onSceneNavigation = deps.onSceneNavigation;
        this.scenes = deps.scenes;
    }

    public consumeSkip(): boolean {
        if (!this.skipRequested) {
            return false;
        }
        this.skipRequested = false;
        return true;
    }

    public destroy() {
        this.destroyed = true;
        this.started = false;
        this.paused = false;
        this.destroyHandlers();
        this.reset();
    }

    public destroyHandlers() {
        for (const handler of this.handlers.values()) {
            void handler.destroy?.();
        }
    }

    public getHandler(type: BaseCommand['type']): RegisteredCommandHandler | undefined {
        return this.handlers.get(type);
    }

    public injectCommands(commands: BaseCommand[]) {
        if (commands.length === 0) return;
        this.injectedCommands = [...commands, ...this.injectedCommands];
    }

    public pause() {
        if (this.destroyed || !this.started) return;
        this.stepRemaining = 0;
        this.paused = true;
        if (!this.isExecuting) {
            this.emitPaused();
        }
    }

    public async playNext() {
        if (this.destroyed || this.isExecuting || !this.started) return;
        this.isExecuting = true;

        try {
            if (this.paused) {
                this.emitPaused();
                return;
            }

            while (
                (this.injectedCommands.length > 0 || this.scenes.currentIndex < this.scenes.scriptLength)
                && !this.destroyed
                && this.started
                && this.isExecuting
            ) {
                const hasInjected = this.injectedCommands.length > 0;
                const index = this.scenes.currentIndex;
                const command = hasInjected
                    ? this.injectedCommands.shift()
                    : this.scenes.getCommandAt(this.scenes.currentIndex++);

                if (!command) continue;
                if (!hasInjected) {
                    this.events.emit('flow:command', this.scenes.currentSceneName, index);
                    if (this.paused) {
                        this.emitPaused();
                        return;
                    }
                }
                await this.runCommand(command);

                if (this.destroyed || !this.isExecuting || !this.started) return;

                if (this.shouldSkipSceneNavigation(command)) {
                    return;
                }

                const handler = this.getHandler(command.type);
                if (handler && !handler.autoNext && !hasInjected) {
                    this._lastSavePoint = this.scenes.getLastOriginalIndex(index);
                    this.isExecuting = false;
                    return;
                }

                if (this.stepRemaining > 0) {
                    this.stepRemaining -= 1;
                    if (this.stepRemaining === 0) {
                        this.paused = true;
                        this.emitPaused();
                        return;
                    }
                }

                if (this.paused) {
                    this.emitPaused();
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


    public registerHandler(handler: RegisteredCommandHandler) {
        this.handlers.set(handler.type, handler);
    }

    public registerHandlers(handlers: RegisteredCommandHandler[]) {
        for (const handler of handlers) {
            this.registerHandler(handler);
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
        this.paused = false;
        this.skipRequested = false;
        this.stepRemaining = 0;
    }


    public resetHandlers() {
        for (const handler of this.handlers.values()) {
            handler.reset?.();
        }
    }

    public resume() {
        if (this.destroyed || !this.started || !this.paused) return;
        this.paused = false;
        this.stepRemaining = 0;
        this.events.emit('flow:resumed', this.scenes.currentSceneName, this.scenes.currentIndex);
        void this.playNext();
    }


    public async runCommand(command: BaseCommand) {
        if (this.destroyed) return;
        const handler = this.getHandler(command.type);
        if (!handler) {
            this.logger.warn(`No handler registered for command type '${command.type}'`);
            return;
        }

        try {
            await handler.execute(command);
            if (this.destroyed) return;
        } catch (error) {
            this.logger.error(
                `Handler '${command.type}' threw during execute: ${String(error)}`
            );
        }
    }

    public start() {
        if (this.destroyed) return;
        this.started = true;
        this.paused = false;
        this.stepRemaining = 0;
        void this.playNext();
    }

    public step() {
        if (this.destroyed || !this.started) return;

        if (!this.paused && !this.isExecuting) {
            this.pause();
        }

        this.paused = false;
        this.stepRemaining = 1;
        this.events.emit('flow:stepped', this.scenes.currentSceneName, this.scenes.currentIndex);
        void this.playNext();
    }

    public stop() {
        this.started = false;
        this.reset();
    }

    private emitPaused() {
        this.events.emit('flow:paused', this.scenes.currentSceneName, this.scenes.currentIndex);
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


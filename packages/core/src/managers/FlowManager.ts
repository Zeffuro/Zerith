import type { EngineConfig } from '../EngineConfig';
import type { CommandHandlerRegistry, RegisteredCommandHandler } from '../interfaces/ICommandHandler';
import type { IEventBus, IFlowManager, ISceneManager } from '../interfaces/managers';
import type { BaseCommand } from '../types';
import type { Logger } from '../utils/Logger';
import type { FlowContinuation, PresentationReplay } from './flowContinuation';

import { parseFlowContinuation } from './flowContinuation';

export interface FlowManagerDeps {
    events: IEventBus;
    handlers: CommandHandlerRegistry;
    logger: Logger;
    onSceneNavigation?: EngineConfig['onSceneNavigation'];
    scenes: ISceneManager;
}

export class FlowManager implements IFlowManager {
    public get isBusy(): boolean {
        return this.isExecuting;
    }

    public get isPaused(): boolean {
        return this.paused;
    }

    public get isRestoringPresentation(): boolean {
        return this.restoringPresentation;
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
    private readonly executingCommands = new Set<{ command: BaseCommand; generation: number }>();
    private executionGeneration = 0;
    private readonly handlers: CommandHandlerRegistry;
    private injectedCommands: BaseCommand[] = [];
    private isExecuting = false;
    private readonly logger: Logger;
    private readonly onSceneNavigation?: EngineConfig['onSceneNavigation'];
    private paused = false;
    private pendingReplay: PresentationReplay | undefined;
    private presentation: PresentationReplay | undefined;
    private restoringPresentation = false;
    private readonly scenes: ISceneManager;
    private selectingCommand = false;
    private skipRequested = false;
    private started = false;
    private stepRemaining = 0;
    private readonly suspensionTokens = new Set<symbol>();
    private readonly suspensionWaiters = new Set<() => void>();
    private waitingHandler: RegisteredCommandHandler | undefined;

    constructor(deps: FlowManagerDeps) {
        this.events = deps.events;
        this.handlers = deps.handlers;
        this.logger = deps.logger;
        this.onSceneNavigation = deps.onSceneNavigation;
        this.scenes = deps.scenes;
    }

    public acquireSuspension(): () => void {
        if (this.destroyed) return () => {};
        const token = Symbol();
        this.suspensionTokens.add(token);
        return () => {
            if (!this.suspensionTokens.delete(token)) return;
            if (this.suspensionTokens.size === 0) this.wakeSuspensionWaiters();
        };
    }

    public captureSaveContinuation(): FlowContinuation {
        if (this.destroyed) throw new Error('A destroyed game cannot be saved.');
        if (this.selectingCommand) throw new Error('Wait for the current command to finish before saving.');
        for (const command of this.executingCommands) {
            if (command.generation === this.executionGeneration
                && this.presentation?.command !== command.command) {
                throw new Error('Wait for the current command to finish before saving.');
            }
        }
        if (this.waitingHandler && !this.presentation) throw new Error('This command cannot be safely resumed from a save.');
        const scene = this.scenes.captureSceneContinuation?.();
        if (!scene) throw new Error('Scene continuation is unavailable.');
        const replay = this.pendingReplay ?? this.presentation;
        const continuation = parseFlowContinuation({ ...scene, injectedCommands: this.injectedCommands, ...(replay ? { replay } : {}) });
        if (!continuation) throw new Error('Game continuation exceeds save limits or contains unsupported data.');
        return continuation;
    }

    public completePresentation(kind: 'choice'): void {
        if (this.presentation?.kind === kind) this.presentation = undefined;
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
        this.suspensionTokens.clear();
        this.destroyHandlers();
        this.reset();
    }

    public destroyHandlers() {
        const handlers = [...new Set(this.handlers.values())];
        this.handlers.clear();
        for (const handler of handlers) {
            try {
                void Promise.resolve(handler.destroy?.()).catch(error => this.logger.error(`Handler '${handler.type}' destroy failed: ${String(error)}`));
            } catch (error) {
                this.logger.error(`Handler '${handler.type}' destroy failed: ${String(error)}`);
            }
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
        await this.playCommands(false);
    }

    public registerHandler(handler: RegisteredCommandHandler) {
        this.handlers.set(handler.type, handler);
    }


    public registerHandlers(handlers: RegisteredCommandHandler[]) {
        for (const handler of handlers) {
            this.registerHandler(handler);
        }
    }

    public async requestAutomaticContinuation(handler: RegisteredCommandHandler): Promise<void> {
        const generation = this.executionGeneration;
        if (this.destroyed || !this.started || this.paused || this.waitingHandler !== handler || !handler.autoNext) return;
        if (this.suspensionTokens.size > 0) await this.waitForSuspensions(generation);
        if (generation !== this.executionGeneration || this.destroyed || !this.started
            || this.paused || this.waitingHandler !== handler || !handler.autoNext) return;
        await this.playCommands(true);
    }

    public requestSkip() {
        if (this.isExecuting) {
            this.skipRequested = true;
        }
    }

    public reset() {
        this.executionGeneration += 1;
        // Caller-owned suspensions survive playback resets.
        this.wakeSuspensionWaiters();
        this.injectedCommands = [];
        this.executingCommands.clear();
        this.pendingReplay = undefined;
        this.presentation = undefined;
        this.restoringPresentation = false;
        this.selectingCommand = false;
        this.isExecuting = false;
        this.paused = false;
        this.skipRequested = false;
        this.stepRemaining = 0;
        this.waitingHandler = undefined;
    }

    public resetHandlers() {
        for (const handler of this.handlers.values()) {
            handler.reset?.();
        }
    }

    public restoreSaveContinuation(continuation: FlowContinuation): void {
        const parsed = parseFlowContinuation(continuation);
        if (this.destroyed || this.isExecuting || !parsed) throw new Error('Save continuation cannot be restored.');
        this.injectedCommands = parsed.injectedCommands;
        this.pendingReplay = parsed.replay;
        this.presentation = undefined;
        this.waitingHandler = undefined;
        this.restoringPresentation = false;
    }

    public resume() {
        if (this.destroyed || !this.started || !this.paused) return;
        this.paused = false;
        this.stepRemaining = 0;
        this.events.emit('flow:resumed', this.scenes.currentSceneName, this.scenes.currentIndex);
        void this.playCommands(true);
    }


    public async runCommand(command: BaseCommand) {
        if (this.destroyed) return;
        const generation = this.executionGeneration;
        const executing = { command, generation };
        this.executingCommands.add(executing);
        try {
            if (this.suspensionTokens.size > 0) await this.waitForSuspensions(generation);
            if (this.destroyed || generation !== this.executionGeneration) return;
            const handler = this.getHandler(command.type);
            if (!handler) {
                this.logger.warn(`No handler registered for command type '${command.type}'`);
                return;
            }
            await handler.execute(command);
            if (this.destroyed) return;
        } catch (error) {
            this.logger.error(
                `Handler '${command.type}' threw during execute: ${String(error)}`
            );
        } finally {
            this.executingCommands.delete(executing);
        }
    }

    public start() {
        if (this.destroyed) return;
        this.started = true;
        this.paused = false;
        this.stepRemaining = 0;
        void this.playCommands(true);
    }


    public step() {
        if (this.destroyed || !this.started) return;

        if (!this.paused && !this.isExecuting) {
            this.pause();
        }

        this.paused = false;
        this.stepRemaining = 1;
        this.events.emit('flow:stepped', this.scenes.currentSceneName, this.scenes.currentIndex);
        void this.playCommands(true);
    }

    public stop() {
        this.started = false;
        this.reset();
    }

    public unregisterHandler(type: BaseCommand['type'], options?: { destroy?: boolean }) {
        const handler = this.handlers.get(type);
        if (!handler) return;
        this.handlers.delete(type);
        if (options?.destroy !== false) return handler.destroy?.();
    }

    private emitPaused() {
        this.events.emit('flow:paused', this.scenes.currentSceneName, this.scenes.currentIndex);
    }

    private emitSceneEnteredForNavigation(command: BaseCommand): void {
        if (command.type === 'jump') {
            const sceneName =
                'to' in command && typeof command.to === 'string'
                    ? command.to
                    : '';
            if (!sceneName) return;
            this.events.emit('flow:scene_entered', sceneName, this.scenes.currentIndex);
            return;
        }

        if (command.type === 'scene_change') {
            const sceneName =
                'assetUrl' in command && typeof command.assetUrl === 'string'
                    ? command.assetUrl
                    : '';
            if (!sceneName) return;
            this.events.emit('flow:scene_entered', sceneName, this.scenes.currentIndex);
        }
    }

    private async playCommands(automatic: boolean) {
        if (this.destroyed || this.isExecuting || !this.started) return;
        if (!automatic && this.suspensionTokens.size > 0) return;
        this.waitingHandler = undefined;
        this.isExecuting = true;
        const generation = this.executionGeneration;

        try {
            if (this.paused) {
                this.emitPaused();
                return;
            }

            while (
                (this.pendingReplay !== undefined || this.injectedCommands.length > 0 || this.scenes.currentIndex < this.scenes.scriptLength)
                && !this.destroyed
                && this.started
                && this.isExecuting
                && generation === this.executionGeneration
            ) {
                if (this.suspensionTokens.size > 0) await this.waitForSuspensions(generation);
                if (generation !== this.executionGeneration || this.destroyed || !this.started) return;
                if (this.paused) {
                    this.emitPaused();
                    return;
                }
                const replay = this.pendingReplay;
                const hasInjected = replay !== undefined || this.injectedCommands.length > 0;
                const index = this.scenes.currentIndex;
                const command = replay?.command ?? (hasInjected
                    ? this.injectedCommands[0]
                    : this.scenes.getCommandAt(index));

                if (!command) {
                    if (!hasInjected) this.scenes.currentIndex++;
                    continue;
                }
                this.selectingCommand = true;
                try {
                    if (!hasInjected) this.events.emit('flow:command', this.scenes.currentSceneName, index);
                    if (this.suspensionTokens.size > 0) await this.waitForSuspensions(generation);
                    if (generation !== this.executionGeneration || !this.started || !this.isExecuting) return;
                    if (this.paused) {
                        this.emitPaused();
                        return;
                    }
                    if (replay) this.pendingReplay = undefined;
                    else if (hasInjected) this.injectedCommands.shift();
                    else {
                        if (this.scenes.currentIndex !== index || this.scenes.getCommandAt(index) !== command) continue;
                        this.scenes.currentIndex++;
                    }
                    this.presentation = command.type === 'dialogue' || command.type === 'choice'
                        ? { command, kind: command.type === 'dialogue' ? 'dialogue' : 'choice' }
                        : undefined;
                } finally {
                    if (generation === this.executionGeneration) this.selectingCommand = false;
                }
                const saveHandler = this.getHandler(command.type);
                if (saveHandler && (command.type === 'dialogue' || !saveHandler.autoNext)) {
                    this._lastSavePoint = this.scenes.getLastOriginalIndex(index);
                }
                this.restoringPresentation = replay !== undefined;
                try {
                    await this.runCommand(command);
                } finally {
                    if (generation === this.executionGeneration) this.restoringPresentation = false;
                }
                if (generation !== this.executionGeneration || this.destroyed || !this.isExecuting || !this.started) return;
                if (this.suspensionTokens.size > 0) await this.waitForSuspensions(generation);
                if (generation !== this.executionGeneration || this.destroyed || !this.isExecuting || !this.started) return;
                this.emitSceneEnteredForNavigation(command);

                if (this.shouldSkipSceneNavigation(command)) {
                    return;
                }

                const handler = this.getHandler(command.type);
                if (handler && !handler.autoNext) {
                    this.waitingHandler = handler;
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
            if (generation !== this.executionGeneration) return;
            const index = this.scenes.currentIndex - 1;
            const command = this.scenes.getCommandAt(index);
            const type = command ? command.type : 'unknown';
            this.logger.error(
                `Error executing command at index ${index} (type: '${type}'): ${String(error)}`
            );
        } finally {
            if (generation === this.executionGeneration) this.isExecuting = false;
        }
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

    private async waitForSuspensions(generation: number): Promise<void> {
        while (this.suspensionTokens.size > 0 && !this.destroyed && generation === this.executionGeneration) {
            await new Promise<void>(resolve => this.suspensionWaiters.add(resolve));
        }
    }

    private wakeSuspensionWaiters(): void {
        for (const resolve of this.suspensionWaiters) resolve();
        this.suspensionWaiters.clear();
    }
}


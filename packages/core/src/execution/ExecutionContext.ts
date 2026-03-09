import type { Container } from 'pixi.js';

import type { EngineSystemKey, EngineSystemMap } from '../Engine';
import type { BaseCommand, GameManifest } from '../types';
import type { Logger } from '../utils/Logger';
import type { Theme } from '../utils/Theme';

/** Audio playback operations with resolver + logger support. */
export type AudioPlaybackContext = CommandExecutionContext;

/** BGM playback with persistent state synchronization. */
export type BgmPlaybackContext = CommandExecutionContext;

/** Interactive choice UI context with input event hooks. */
export type ChoiceInteractionContext = CommandExecutionContext;

export interface CommandExecutionContext extends SystemRegistry {
    assetResolver(url: string): string;
    autoAdvanceDelay?: number;
    consumeSkip(): boolean;
    getLayer(name: LayerName): Container;
    getState<T = unknown>(key: string): T | undefined;
    injectCommands(commands: BaseCommand[]): void;
    loadAsset<T = unknown>(url: string): Promise<T>;
    logger: Logger;
    manifest: GameManifest;
    playNext(): Promise<void>;
    resolveText(text: string): string;
    runCommand(command: BaseCommand): Promise<void>;
    setState(key: string, value: unknown): void;
    theme: Theme;
}

/** Conditional checks over inventory/evidence and state values. */
export type ConditionalContext = CommandExecutionContext;

export type ContextWithAssets = CommandExecutionContext;

export type ContextWithAudio = CommandExecutionContext;

export type ContextWithDisplay = CommandExecutionContext;

export type ContextWithEvents = CommandExecutionContext;

export type ContextWithFlow = CommandExecutionContext;

export type ContextWithHistory = CommandExecutionContext;

export type ContextWithItems = CommandExecutionContext;

export type ContextWithLayers = CommandExecutionContext;

export type ContextWithLogging = CommandExecutionContext;

export type ContextWithManifest = CommandExecutionContext;

export type ContextWithNotifications = CommandExecutionContext;

export type ContextWithOverlay = CommandExecutionContext;

export type ContextWithSaves = CommandExecutionContext;

export type ContextWithScenes = CommandExecutionContext;

export type ContextWithState = CommandExecutionContext;

export type ContextWithTheme = CommandExecutionContext;

/** Dialogue runtime context (rendering, history, audio, flow, state). */
export type DialogueExecutionContext = CommandExecutionContext;

/** Dialogue renderer-only surface (no flow/state mutation). */
export type DialogueRenderContext = CommandExecutionContext;

// Compatibility alias while handlers migrate to narrower context constraints.
export type ExecutionContext = CommandExecutionContext;

/** Command flow + state reads/writes for scripted control structures. */
export type FlowStateContext = ContextWithFlow  ;

export interface HandlerRuntime {
    assetResolver(url: string): string;
    consumeSkip(): boolean;
    getAutoAdvanceDelay(): number | undefined;
    getManifest(): GameManifest;
    getState<T = unknown>(key: string): T | undefined;
    getTheme(): Theme;
    injectCommands(commands: BaseCommand[]): void;
    loadAsset<T = unknown>(url: string): Promise<T>;
    logger: Logger;
    playNext(): Promise<void>;
    resolveText(text: string): string;
    runCommand(command: BaseCommand): Promise<void>;
    setState(key: string, value: unknown): void;
}

export type LayerManager = Record<LayerName, Container>;

export type LayerName = 'background' | 'overlay' | 'sprites' | 'ui';

/** While-like loops that need flow control plus logging on guard limits. */
export type LoopContext = CommandExecutionContext;

/** Conditional checks that also inject scene commands. */
export type SceneConditionalContext = CommandExecutionContext;

/** Handlers that only inject or navigate scenes. */
export type SceneInjectionContext = CommandExecutionContext;

/** Scene operations that may also log warnings or diagnostics. */
export type SceneTemplateContext = CommandExecutionContext;

/** Sprite-heavy rendering + animation context. */
export type SpriteExecutionContext = CommandExecutionContext;

/** Visual state updates that must persist in system state. */
export type StatefulVisualContext = CommandExecutionContext;

export interface SystemRegistry {
    getSystem<K extends EngineSystemKey>(key: K): EngineSystemMap[K];
}

/** Full-screen visuals that only touch display sizing and render layers. */
export type VisualEffectContext = CommandExecutionContext;

export class HandlerExecutionContext implements CommandExecutionContext {
    public get autoAdvanceDelay(): number | undefined {
        return this.runtime.getAutoAdvanceDelay();
    }
    public get logger(): Logger {
        return this.runtime.logger;
    }

    public get manifest(): GameManifest {
        return this.runtime.getManifest();
    }

    public get theme(): Theme {
        return this.runtime.getTheme();
    }

    private readonly runtime: HandlerRuntime;

    private readonly systems: SystemRegistry;

    constructor(
        systems: SystemRegistry,
        runtime: HandlerRuntime
    ) {
        this.systems = systems;
        this.runtime = runtime;
    }

    public assetResolver(url: string): string {
        return this.runtime.assetResolver(url);
    }

    public consumeSkip(): boolean {
        return this.runtime.consumeSkip();
    }

    public getLayer(name: LayerName): Container {
        return this.getSystem('display').getLayer(name);
    }

    public getState<T = unknown>(key: string): T | undefined {
        return this.runtime.getState<T>(key);
    }

    public getSystem<K extends EngineSystemKey>(key: K): EngineSystemMap[K] {
        return this.systems.getSystem(key);
    }

    public injectCommands(commands: BaseCommand[]): void {
        this.runtime.injectCommands(commands);
    }

    public loadAsset<T = unknown>(url: string): Promise<T> {
        return this.runtime.loadAsset<T>(url);
    }

    public playNext(): Promise<void> {
        return this.runtime.playNext();
    }

    public resolveText(text: string): string {
        return this.runtime.resolveText(text);
    }

    public runCommand(command: BaseCommand): Promise<void> {
        return this.runtime.runCommand(command);
    }

    public setState(key: string, value: unknown): void {
        this.runtime.setState(key, value);
    }
}

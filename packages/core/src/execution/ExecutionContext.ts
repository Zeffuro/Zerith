import type { Container } from 'pixi.js';

import type {
    IAssetManager,
    IAudioManager,
    IDisplayManager,
    IEventBus,
    IEvidenceManager,
    IHistoryManager,
    INotificationManager,
    IOverlayManager,
    ISaveManager,
    ISceneManager,
    ISpritesheetManager,
    IStartScreenManager,
    IStateManager,
} from '../interfaces/managers';
import type { BaseCommand, GameManifest } from '../types';
import type { Logger } from '../utils/Logger';
import type { Theme } from '../utils/Theme';

export interface ExecutionContext {
    assetResolver(url: string): string;
    assets: IAssetManager;
    audio: IAudioManager;
    autoAdvanceDelay?: number;
    consumeSkip(): boolean;
    display: IDisplayManager;
    events: IEventBus;
    getState<T = unknown>(key: string): T | undefined;
    history: IHistoryManager;
    injectCommands(commands: BaseCommand[]): void;
    items: IEvidenceManager;
    layers: LayerManager;
    loadAsset<T = unknown>(url: string): Promise<T>;
    logger: Logger;
    manifest: GameManifest;
    notifications: INotificationManager;
    overlay: IOverlayManager;
    playNext(): Promise<void>;
    resolveText(text: string): string;
    runCommand(command: BaseCommand): Promise<void>;
    saves: ISaveManager;
    scenes: ISceneManager;
    setState(key: string, value: unknown): void;
    spritesheets: ISpritesheetManager;
    startScreen: IStartScreenManager;
    stateManager: IStateManager;
    theme: Theme;
}

export interface LayerManager {
    background: Container;
    overlay: Container;
    sprites: Container;
    ui: Container;
}


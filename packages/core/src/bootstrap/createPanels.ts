import type { Engine } from '../Engine';
import type { DialogueHandler } from '../handlers/DialogueHandler';
import type { IAssetManager, IEvidenceManager, IHistoryManager, INotificationManager, IOverlayManager, ISaveManager } from '../interfaces/managers';
import type { MenuPanel } from '../types';

import { HistoryPanel } from '../ui/HistoryPanel';
import { ItemBrowserPanel } from '../ui/ItemBrowserPanel';
import { SaveLoadPanel } from '../ui/SaveLoadPanel';
import { SettingsPanel } from '../ui/SettingsPanel';
import { Logger } from '../utils/Logger';

export interface CreatePanelsOptions {
    assets: IAssetManager;
    dialogueHandler: DialogueHandler;
    engine: Engine;
    evidence: IEvidenceManager;
    history: IHistoryManager;
    notifications: INotificationManager;
    overlay: IOverlayManager;
    saveManager: ISaveManager;
}

export function createPanels(options: CreatePanelsOptions): MenuPanel[] {
    const {
        assets,
        dialogueHandler,
        engine,
        evidence,
        history,
        notifications,
        overlay,
        saveManager,
    } = options;

    return [
        new HistoryPanel(history),
        new ItemBrowserPanel(evidence, (url) => assets.load(url), new Logger('[ItemDetailView]')),
        new SettingsPanel(engine.audio, dialogueHandler),
        new SaveLoadPanel('save', saveManager, notifications, (saveState) => engine.applySaveState(saveState), () => overlay.close()),
        new SaveLoadPanel('load', saveManager, notifications, (saveState) => engine.applySaveState(saveState), () => overlay.close()),
    ];
}


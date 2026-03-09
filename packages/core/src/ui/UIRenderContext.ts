import type { Container } from 'pixi.js';

import type { RegisteredCommandHandler } from '../interfaces/ICommandHandler';
import type {
    IAudioManager,
    IEvidenceManager,
    IHistoryManager,
    INotificationManager,
    ISaveManager,
    IStateManager,
} from '../interfaces/managers';
import type { OverlayConfig } from '../managers/OverlayManager';
import type { SaveState } from '../managers/SaveManager';
import type { CommandType } from '../types';
import type { MenuPanel } from '../types/MenuPanel';
import type { Theme } from '../utils/Theme';
import type { PanelFocusManager } from './PanelFocusManager';
import type { UIContext } from './UIComponents';

export type ReadonlyEvidenceManager = Pick<IEvidenceManager, 'get' | 'getAll' | 'getEvidence' | 'getProfiles' | 'has'>;
export type ReadonlyHistoryManager = Pick<IHistoryManager, 'getAll' | 'getRecent' | 'length'>;

export interface UIRenderContext {
    applySaveState: (saveState: SaveState) => Promise<void>;
    audio: IAudioManager;
    autoAdvanceDelay: number | undefined;
    canvasElement: HTMLCanvasElement;
    canvasHeight: number;
    canvasWidth: number;
    closeOverlay: () => void;
    createPanelBase: () => Container;
    focus: PanelFocusManager;
    getHandler: (type: CommandType) => RegisteredCommandHandler | undefined;
    history: ReadonlyHistoryManager;
    items: ReadonlyEvidenceManager;
    loadAsset: <T = unknown>(url: string) => Promise<T>;
    notifications: INotificationManager;
    overlayConfig: Required<OverlayConfig>;
    saves: ISaveManager;
    setAutoAdvance: (delayMs: number | undefined) => void;
    showPanel: (panel: MenuPanel) => void;
    state: IStateManager;
    theme: Theme;
    uiContext: UIContext;
}


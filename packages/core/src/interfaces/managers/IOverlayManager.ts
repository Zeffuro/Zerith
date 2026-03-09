import type { Container } from 'pixi.js';

import type { OverlayConfig } from '../../managers/OverlayManager';
import type { MenuPanel } from '../../types';
import type { PanelFocusManager } from '../../ui/PanelFocusManager';
import type { UIContext } from '../../ui/UIComponents';
import type { IBaseManager } from './IBaseManager';

export interface IOverlayManager extends IBaseManager {
    close(): void;
    closePanel(): void;
    config: Required<OverlayConfig>;
    createPanelBase(): Container;
    readonly focus: PanelFocusManager;
    getUIContext(): UIContext;
    readonly isOpen: boolean;
    open(): void;
    registerPanel(panel: MenuPanel): void;
    scale(value: number): number;
    showPanel(panel: MenuPanel): void;
    toggle(): void;
}


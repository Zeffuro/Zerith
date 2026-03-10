import type { OverlayConfig } from '../../managers/OverlayManager';
import type { MenuPanel } from '../../types';
import type { PanelFocusManager } from '../../ui/PanelFocusManager';
import type { IBaseManager } from './IBaseManager';

export interface IOverlayManager extends IBaseManager {
    close(): void;
    closePanel(): void;
    config: Required<OverlayConfig>;
    readonly focus: PanelFocusManager;
    readonly isOpen: boolean;
    open(): void;
    registerPanel(panel: MenuPanel): void;
    scale(value: number): number;
    showPanel(panel: MenuPanel): void;
    toggle(): void;
}


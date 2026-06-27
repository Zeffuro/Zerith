import type { OverlayConfig } from '../../managers/OverlayManager';
import type { MenuPanel } from '../../types';
import type { PanelFocusManager } from '../../ui/PanelFocusManager';
import type { IBaseManager } from './IBaseManager';

export interface IOverlayManager extends IBaseManager {
    close(): void;
    closePanel(): void;
    config: Required<OverlayConfig>;
    readonly focus: PanelFocusManager;
    hasPanel(id: string): boolean;
    readonly isOpen: boolean;
    open(): void;
    registerPanel(panel: MenuPanel): void;
    removePanel(id: string): void;
    scale(value: number): number;
    showPanel(panel: MenuPanel): void;
    toggle(): void;
}


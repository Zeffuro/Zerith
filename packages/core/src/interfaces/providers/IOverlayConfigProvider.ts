import type { OverlayConfig } from '../../managers/OverlayManager';

export interface IOverlayConfigProvider {
    getConfig(): Required<OverlayConfig>;
}


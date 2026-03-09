import type { Texture } from 'pixi.js';

import type { AssetResolver } from '../../Engine';
import type { SpritesheetConfig } from '../../types';
import type { IBaseManager } from './IBaseManager';

export interface ISpritesheetManager extends IBaseManager {
    clear(): void;
    getFrame(atlasUrl: string, frameName: string): Texture | undefined;
    getFrameNames(atlasUrl: string): string[];
    has(atlasUrl: string): boolean;
    load(config: SpritesheetConfig): Promise<unknown>;
    setResolver(resolver: AssetResolver): void;
}


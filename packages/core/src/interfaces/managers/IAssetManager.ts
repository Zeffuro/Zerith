import type { AssetResolver } from '../../Engine';
import type { CharacterDefinition, Script } from '../../types';
import type { IBaseManager } from './IBaseManager';

export interface IAssetManager extends IBaseManager {
    extractAssetUrls(script: Script): { audio: Set<string>; textures: Set<string> };
    preloadCharacterAssets(characters: Record<string, CharacterDefinition>): Promise<void>;
    preloadSceneAssets(script: Script): Promise<void>;
    setResolver(resolver: AssetResolver): void;
}


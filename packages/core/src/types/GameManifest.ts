import type { CharacterDefinition } from './Character';
import type { ItemManifestEntry } from './Item';

export interface GameManifest {
    characters?: Record<string, CharacterDefinition>;
    items?: Record<string, ItemManifestEntry>;
    macros?: Record<string, any[]>;
    scenes?: Record<string, any[] | string>;
    startScene?: string;
    title?: string;
}
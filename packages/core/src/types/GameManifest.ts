import type { CharacterDefinition } from './Character';
import type { ItemManifestEntry } from './Item';

export interface GameManifest {
    title?: string;
    startScene?: string;
    characters?: Record<string, CharacterDefinition>;
    items?: Record<string, ItemManifestEntry>;
    macros?: Record<string, any[]>;
    scenes?: Record<string, string | any[]>;
}
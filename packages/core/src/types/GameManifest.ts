import type { CharacterDefinition } from './Character';
import type { BaseCommand } from './Commands';
import type { ItemManifestEntry } from './Item';

export interface GameManifest {
    characters?: Record<string, CharacterDefinition>;
    items?: Record<string, ItemManifestEntry>;
    macros?: Record<string, BaseCommand[]>;
    scenes?: Record<string, BaseCommand[] | string>;
    startScene?: string;
    title?: string;
    version?: string;
}
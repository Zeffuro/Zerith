import type { CharacterDefinition } from './Character';
import type { BaseCommand } from './Commands';
import type { ItemManifestEntry } from './Item';

export interface GameManifest {
    $schema?: string;
    author?: string;
    characters?: Record<string, CharacterDefinition>;
    description?: string;
    items?: Record<string, ItemManifestEntry>;
    license?: string;
    macros?: Record<string, BaseCommand[]>;
    scenes?: Record<string, BaseCommand[] | string>;
    startScene?: string;
    title?: string;
    variables?: Record<string, unknown>;
    version?: string;
}
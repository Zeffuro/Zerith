import type { CharacterDefinition } from './Character';
import type { BaseCommand } from './Commands';
import type { ItemManifestEntry } from './Item';
import type { LocalizationConfig } from './Localization';

export interface GameManifest {
    $schema?: string;
    author?: string;
    characters?: Record<string, CharacterDefinition> | string;
    description?: string;
    items?: Record<string, ItemManifestEntry> | string;
    license?: string;
    localization?: LocalizationConfig;
    macros?: Record<string, BaseCommand[]> | string;
    scenes?: Record<string, BaseCommand[] | SceneFile | string>;
    schemaVersion?: 1 | 2;
    startScene?: string;
    title?: string;
    variables?: Record<string, unknown>;
    version?: string;
}

export interface SceneFile {
    $schema?: string;
    commands: BaseCommand[];
    graph?: Record<string, unknown>;
    id?: string;
    localeNamespace?: string;
    schemaVersion?: 1 | 2;
}

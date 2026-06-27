import type { AnimationConfig } from './Animation';
import type { DisplayDefaults } from './Display';
import type { SpritesheetConfig } from './Spritesheet';

export interface CharacterDefinition {
    animations?: Record<string, AnimationConfig>;
    blipUrl?: string;
    displayDefaults?: DisplayDefaults;
    displayName: string;
    name: string;
    nameColor?: string;
    portraitUrl?: string;
    poses?: Record<string, string>;
    schemaVersion?: 1 | 2;
    spritesheet?: SpritesheetConfig;
    talkAnimation?: string;
}

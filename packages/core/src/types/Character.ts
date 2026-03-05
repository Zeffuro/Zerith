import type { DisplayDefaults } from './Display';
import type { AnimationConfig } from './Animation';
import type { SpritesheetConfig } from './Spritesheet';

export interface CharacterDefinition {
    displayName: string;
    nameColor?: string;
    portraitUrl?: string;
    blipUrl?: string;
    spritesheet?: SpritesheetConfig;
    displayDefaults?: DisplayDefaults;
    talkAnimation?: string;
    poses?: Record<string, string>;
    animations?: Record<string, AnimationConfig>;
}
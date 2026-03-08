import type { AnimationConfig } from './Animation';
import type { DisplayDefaults } from './Display';
import type { SpritesheetConfig } from './Spritesheet';

export interface CharacterDefinition {
    animations?: Record<string, AnimationConfig>;
    blipUrl?: string;
    displayDefaults?: DisplayDefaults;
    displayName: string;
    nameColor?: string;
    portraitUrl?: string;
    poses?: Record<string, string>;
    spritesheet?: SpritesheetConfig;
    talkAnimation?: string;
}
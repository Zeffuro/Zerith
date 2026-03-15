import type { AudiosheetDescriptor, BaseCommand, SpritesheetDescriptor } from '../types';

export function audiosheetDescriptor(overrides: Partial<AudiosheetDescriptor> = {}): AudiosheetDescriptor {
    return {
        cues: {
            click: {
                start: 0,
            },
        },
        source: 'assets/sfx/ui.mp3',
        ...overrides,
    };
}

export function scriptOf(...commands: BaseCommand[]): BaseCommand[] {
    return commands;
}

export function spritesheetDescriptor(overrides: Partial<SpritesheetDescriptor> = {}): SpritesheetDescriptor {
    return {
        format: 'grid',
        frameHeight: 64,
        frameWidth: 64,
        source: 'assets/sprites/hero.png',
        ...overrides,
    };
}


export function waitCommand(overrides: Partial<BaseCommand> = {}): BaseCommand {
    return {
        duration: 0,
        type: 'wait',
        ...overrides,
    } as BaseCommand;
}

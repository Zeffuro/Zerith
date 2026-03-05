import type { Engine } from './Engine';
import type { Container } from 'pixi.js';

export interface BaseCommand {
    type: string;
    [key: string]: any;
}

export interface CommandHandler<TCmd extends BaseCommand = BaseCommand> {
    type: string;
    autoNext?: boolean;
    execute: (command: TCmd, engine: Engine) => Promise<void>;
    reset?: () => void;
}

export type Script = BaseCommand[];
export type SceneMap = Record<string, Script>;

/**
 * A pluggable panel shown from the pause menu.
 * Each panel owns its own rendering and cleanup.
 */
export interface MenuPanel {
    label: string;
    id: string;
    build(engine: Engine, onClose: () => void): {
        container: Container;
        cleanup?: () => void;
    };
}
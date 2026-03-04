import type { Engine } from '../Engine';

export interface InputConfig {
    advanceKeys?: string[];
    saveKey?: string;
    loadKey?: string;
    menuKey?: string;
    gamepadAdvanceButton?: number;
    gamepadMenuButton?: number;
}

export class InputManager {
    private engine: Engine;
    private config: Required<InputConfig>;
    private canvas: HTMLCanvasElement | null = null;
    private boundOnPointerDown: (() => void) | null = null;
    private boundOnKeyDown: ((e: KeyboardEvent) => void) | null = null;
    private gamepadPollId: number | null = null;
    private prevGamepadButtons: boolean[] = [];

    constructor(engine: Engine, config: InputConfig = {}) {
        this.engine = engine;
        this.config = {
            advanceKeys: ['Enter', ' ', 'ArrowRight'],
            saveKey: 's',
            loadKey: 'l',
            menuKey: 'Escape',
            gamepadAdvanceButton: 0,
            gamepadMenuButton: 9,
            ...config
        };
    }

    public attach(canvas: HTMLCanvasElement) {
        this.canvas = canvas;

        this.boundOnPointerDown = () => {
            if (this.engine.isStarted && !this.engine.pauseMenu.isOpen) {
                this.engine.requestSkip();
                this.engine.playNext();
            }
        };

        canvas.addEventListener('pointerdown', this.boundOnPointerDown);

        this.boundOnKeyDown = (e: KeyboardEvent) => {
            if (!this.engine.isStarted) {
                if (this.config.advanceKeys.includes(e.key)) {
                    e.preventDefault();
                    this.engine.emit('input:start');
                }
                return;
            }

            if (this.config.advanceKeys.includes(e.key)) {
                e.preventDefault();
                if (!this.engine.pauseMenu.isOpen) {
                    this.engine.requestSkip();
                    this.engine.playNext();
                }
                return;
            }

            const key = e.key.toLowerCase();
            if (key === this.config.saveKey) {
                this.engine.saves.save(1);
                this.engine.notifications.show('Game Saved!');
            } else if (key === this.config.loadKey) {
                this.engine.saves.load(1);
                this.engine.notifications.show('Game Loaded!');
            } else if (key === this.config.menuKey.toLowerCase()) {
                this.engine.emit('menu:toggle');
            }
        };
        window.addEventListener('keydown', this.boundOnKeyDown);

        this.startGamepadPolling();
    }

    public detach() {
        if (this.canvas && this.boundOnPointerDown) {
            this.canvas.removeEventListener('pointerdown', this.boundOnPointerDown);
        }
        if (this.boundOnKeyDown) {
            window.removeEventListener('keydown', this.boundOnKeyDown);
        }
        this.stopGamepadPolling();

        this.boundOnPointerDown = null;
        this.boundOnKeyDown = null;
        this.canvas = null;
    }

    private startGamepadPolling() {
        const poll = () => {
            const gamepad = navigator.getGamepads()[0];
            if (gamepad) {
                const buttons = gamepad.buttons.map(b => b.pressed);

                const advanceBtn = this.config.gamepadAdvanceButton;
                const menuBtn = this.config.gamepadMenuButton;

                if (buttons[advanceBtn] && !this.prevGamepadButtons[advanceBtn]) {
                    if (this.engine.isStarted && !this.engine.pauseMenu.isOpen) {
                        this.engine.requestSkip();
                        this.engine.playNext();
                    } else if (!this.engine.isStarted) {
                        this.engine.emit('input:start');
                    }
                }

                if (buttons[menuBtn] && !this.prevGamepadButtons[menuBtn]) {
                    if (this.engine.isStarted) {
                        this.engine.emit('menu:toggle');
                    }
                }

                this.prevGamepadButtons = buttons;
            }
            this.gamepadPollId = requestAnimationFrame(poll);
        };
        this.gamepadPollId = requestAnimationFrame(poll);
    }

    private stopGamepadPolling() {
        if (this.gamepadPollId !== null) {
            cancelAnimationFrame(this.gamepadPollId);
            this.gamepadPollId = null;
        }
    }
}
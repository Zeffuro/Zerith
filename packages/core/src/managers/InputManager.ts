import type { Engine } from '../Engine';

export interface InputConfig {
    advanceKeys?: string[];
    backKeys?: string[];
    saveKey?: string;
    loadKey?: string;
    menuKey?: string;
    navigateUpKeys?: string[];
    navigateDownKeys?: string[];
    navigateLeftKeys?: string[];
    navigateRightKeys?: string[];
    confirmKeys?: string[];
    gamepadAdvanceButton?: number;
    gamepadMenuButton?: number;
    gamepadBackButton?: number;
    gamepadConfirmButton?: number;
    gamepadUpButton?: number;
    gamepadDownButton?: number;
    gamepadLeftButton?: number;
    gamepadRightButton?: number;
}

export class InputManager {
    private engine: Engine;
    private config: Required<InputConfig>;
    private canvas: HTMLCanvasElement | null = null;
    private boundOnPointerDown: (() => void) | null = null;
    private boundOnKeyDown: ((e: KeyboardEvent) => void) | null = null;
    private gamepadPollId: number | null = null;
    private prevGamepadButtons: boolean[] = [];
    private prevGamepadAxes: number[] = [];

    constructor(engine: Engine, config: InputConfig = {}) {
        this.engine = engine;
        this.config = {
            advanceKeys: ['Enter', ' '],
            backKeys: ['Escape'],
            saveKey: 's',
            loadKey: 'l',
            menuKey: 'Escape',
            navigateUpKeys: ['ArrowUp', 'w', 'W'],
            navigateDownKeys: ['ArrowDown', 's', 'S'],
            navigateLeftKeys: ['ArrowLeft', 'a', 'A'],
            navigateRightKeys: ['ArrowRight', 'd', 'D'],
            confirmKeys: ['Enter', ' '],
            gamepadAdvanceButton: 0,
            gamepadMenuButton: 9,
            gamepadBackButton: 1,
            gamepadConfirmButton: 0,
            gamepadUpButton: 12,
            gamepadDownButton: 13,
            gamepadLeftButton: 14,
            gamepadRightButton: 15,
            ...config
        };
    }

    public attach(canvas: HTMLCanvasElement) {
        this.canvas = canvas;

        this.boundOnPointerDown = () => {
            if (this.engine.isStarted && !this.engine.overlay.isOpen) {
                this.engine.requestSkip();
                this.engine.playNext();
            }
        };
        canvas.addEventListener('pointerdown', this.boundOnPointerDown);

        this.boundOnKeyDown = (e: KeyboardEvent) => {
            // Navigation (always emit, panels may need it)
            if (this.config.navigateUpKeys.includes(e.key)) {
                this.engine.emit('input:navigate', 'up');
            }
            if (this.config.navigateDownKeys.includes(e.key)) {
                this.engine.emit('input:navigate', 'down');
            }
            if (this.config.navigateLeftKeys.includes(e.key)) {
                this.engine.emit('input:navigate', 'left');
            }
            if (this.config.navigateRightKeys.includes(e.key)) {
                this.engine.emit('input:navigate', 'right');
            }

            // Confirm
            if (this.config.confirmKeys.includes(e.key)) {
                this.engine.emit('input:confirm');
            }

            // Back / Menu key (Escape etc.)
            if (this.config.backKeys.includes(e.key)) {
                e.preventDefault();
                if (this.engine.overlay.isOpen) {
                    this.engine.emit('input:back');
                } else if (this.engine.isStarted) {
                    this.engine.emit('menu:toggle');
                }
                return;
            }

            // Start screen
            if (!this.engine.isStarted) {
                if (this.config.advanceKeys.includes(e.key)) {
                    e.preventDefault();
                    this.engine.emit('input:start');
                }
                return;
            }

            // Advance dialogue
            if (this.config.advanceKeys.includes(e.key)) {
                e.preventDefault();
                if (!this.engine.overlay.isOpen) {
                    this.engine.requestSkip();
                    this.engine.playNext();
                }
                return;
            }

            // System keys (save/load shortcuts)
            const key = e.key.toLowerCase();
            if (key === this.config.saveKey) {
                this.engine.saves.save(1);
                this.engine.notifications.show('Game Saved!');
            } else if (key === this.config.loadKey) {
                this.engine.saves.load(1);
                this.engine.notifications.show('Game Loaded!');
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
                const axes = [...gamepad.axes];

                const pressed = (btn: number) => buttons[btn] && !this.prevGamepadButtons[btn];

                // D-pad buttons
                if (pressed(this.config.gamepadUpButton)) {
                    this.engine.emit('input:navigate', 'up');
                }
                if (pressed(this.config.gamepadDownButton)) {
                    this.engine.emit('input:navigate', 'down');
                }
                if (pressed(this.config.gamepadLeftButton)) {
                    this.engine.emit('input:navigate', 'left');
                }
                if (pressed(this.config.gamepadRightButton)) {
                    this.engine.emit('input:navigate', 'right');
                }

                // Left stick Y axis
                const stickY = axes[1] ?? 0;
                const prevStickY = this.prevGamepadAxes[1] ?? 0;
                if (stickY < -0.5 && prevStickY >= -0.5) {
                    this.engine.emit('input:navigate', 'up');
                }
                if (stickY > 0.5 && prevStickY <= 0.5) {
                    this.engine.emit('input:navigate', 'down');
                }

                // Left stick X axis
                const stickX = axes[0] ?? 0;
                const prevStickX = this.prevGamepadAxes[0] ?? 0;
                if (stickX < -0.5 && prevStickX >= -0.5) {
                    this.engine.emit('input:navigate', 'left');
                }
                if (stickX > 0.5 && prevStickX <= 0.5) {
                    this.engine.emit('input:navigate', 'right');
                }

                // Confirm (A button)
                if (pressed(this.config.gamepadConfirmButton)) {
                    this.engine.emit('input:confirm');
                }

                // Back (B / Circle button)
                if (pressed(this.config.gamepadBackButton)) {
                    if (this.engine.overlay.isOpen) {
                        this.engine.emit('input:back');
                    } else if (this.engine.isStarted) {
                        this.engine.emit('menu:toggle');
                    }
                }

                // Advance (A button, only when not in overlay)
                if (pressed(this.config.gamepadAdvanceButton)) {
                    if (this.engine.isStarted && !this.engine.overlay.isOpen) {
                        this.engine.requestSkip();
                        this.engine.playNext();
                    } else if (!this.engine.isStarted) {
                        this.engine.emit('input:start');
                    }
                }

                // Menu (Start button)
                if (pressed(this.config.gamepadMenuButton)) {
                    if (this.engine.isStarted) {
                        if (this.engine.overlay.isOpen) {
                            this.engine.emit('input:back');
                        } else {
                            this.engine.emit('menu:toggle');
                        }
                    }
                }

                this.prevGamepadButtons = buttons;
                this.prevGamepadAxes = axes;
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
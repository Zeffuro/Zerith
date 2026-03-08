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

    // Initialize these as null
    private boundOnPointerDown: ((e: PointerEvent) => void) | null = null;
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
        if (this.canvas) {
            this.detach();
        }

        this.canvas = canvas;

        this.boundOnPointerDown = (_: PointerEvent) => {
            if (this.engine.isStarted && !this.engine.overlay.isOpen) {
                this.engine.events.emit('input:next');
                this.engine.requestSkip();
                this.engine.playNext();
            }
        };

        this.boundOnKeyDown = (e: KeyboardEvent) => {
            const isGameKey = [
                ...this.config.navigateUpKeys,
                ...this.config.navigateDownKeys,
                ...this.config.navigateLeftKeys,
                ...this.config.navigateRightKeys,
                ...this.config.advanceKeys
            ].includes(e.key);

            if (isGameKey) {
                // e.preventDefault();
            }

            // Navigation
            if (this.config.navigateUpKeys.includes(e.key)) {
                this.engine.events.emit('input:navigate', 'up');
            }
            if (this.config.navigateDownKeys.includes(e.key)) {
                this.engine.events.emit('input:navigate', 'down');
            }
            if (this.config.navigateLeftKeys.includes(e.key)) {
                this.engine.events.emit('input:navigate', 'left');
            }
            if (this.config.navigateRightKeys.includes(e.key)) {
                this.engine.events.emit('input:navigate', 'right');
            }

            // Confirm
            if (this.config.confirmKeys.includes(e.key)) {
                this.engine.events.emit('input:confirm');
            }

            // Back / Menu
            if (this.config.backKeys.includes(e.key)) {
                e.preventDefault();
                if (this.engine.overlay.isOpen) {
                    this.engine.events.emit('input:back');
                } else if (this.engine.isStarted) {
                    this.engine.events.emit('menu:toggle');
                }
                return;
            }

            // Start screen
            if (!this.engine.isStarted) {
                if (this.config.advanceKeys.includes(e.key)) {
                    e.preventDefault();
                    this.engine.events.emit('input:start');
                }
                return;
            }

            // Advance dialogue
            if (this.config.advanceKeys.includes(e.key)) {
                e.preventDefault();
                if (!this.engine.overlay.isOpen) {
                    this.engine.events.emit('input:next');
                    this.engine.requestSkip();
                    this.engine.playNext();
                }
                return;
            }

            // Save/Load Shortcuts
            const key = e.key.toLowerCase();
            if (key === this.config.saveKey) {
                this.engine.saves.save(1);
                this.engine.notifications.show('Game Saved!');
            } else if (key === this.config.loadKey) {
                this.engine.saves.load(1);
                this.engine.notifications.show('Game Loaded!');
            }
        };

        // 3. Attach listeners
        canvas.addEventListener('pointerdown', this.boundOnPointerDown);
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
        this.stopGamepadPolling();

        const poll = () => {
            const gamepad = navigator.getGamepads()[0];
            if (gamepad) {
                const buttons = gamepad.buttons.map(b => b.pressed);
                const axes = [...gamepad.axes];

                const pressed = (btn: number) => buttons[btn] && !this.prevGamepadButtons[btn];

                // D-pad buttons
                if (pressed(this.config.gamepadUpButton)) this.engine.events.emit('input:navigate', 'up');
                if (pressed(this.config.gamepadDownButton)) this.engine.events.emit('input:navigate', 'down');
                if (pressed(this.config.gamepadLeftButton)) this.engine.events.emit('input:navigate', 'left');
                if (pressed(this.config.gamepadRightButton)) this.engine.events.emit('input:navigate', 'right');

                // Axes
                const stickY = axes[1] ?? 0;
                const prevStickY = this.prevGamepadAxes[1] ?? 0;
                if (stickY < -0.5 && prevStickY >= -0.5) this.engine.events.emit('input:navigate', 'up');
                if (stickY > 0.5 && prevStickY <= 0.5) this.engine.events.emit('input:navigate', 'down');

                const stickX = axes[0] ?? 0;
                const prevStickX = this.prevGamepadAxes[0] ?? 0;
                if (stickX < -0.5 && prevStickX >= -0.5) this.engine.events.emit('input:navigate', 'left');
                if (stickX > 0.5 && prevStickX <= 0.5) this.engine.events.emit('input:navigate', 'right');

                // Buttons
                if (pressed(this.config.gamepadConfirmButton)) this.engine.events.emit('input:confirm');

                if (pressed(this.config.gamepadBackButton)) {
                    if (this.engine.overlay.isOpen) this.engine.events.emit('input:back');
                    else if (this.engine.isStarted) this.engine.events.emit('menu:toggle');
                }

                if (pressed(this.config.gamepadAdvanceButton)) {
                    if (this.engine.isStarted && !this.engine.overlay.isOpen) {
                        this.engine.events.emit('input:next');
                        this.engine.requestSkip();
                        this.engine.playNext();
                    } else if (!this.engine.isStarted) {
                        this.engine.events.emit('input:start');
                    }
                }

                if (pressed(this.config.gamepadMenuButton)) {
                    if (this.engine.isStarted) {
                        if (this.engine.overlay.isOpen) this.engine.events.emit('input:back');
                        else this.engine.events.emit('menu:toggle');
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
import type { Engine } from '../Engine';

export interface InputConfig {
    advanceKeys?: string[];
    backKeys?: string[];
    confirmKeys?: string[];
    gamepadAdvanceButton?: number;
    gamepadBackButton?: number;
    gamepadConfirmButton?: number;
    gamepadDownButton?: number;
    gamepadLeftButton?: number;
    gamepadMenuButton?: number;
    gamepadRightButton?: number;
    gamepadUpButton?: number;
    loadKey?: string;
    menuKey?: string;
    navigateDownKeys?: string[];
    navigateLeftKeys?: string[];
    navigateRightKeys?: string[];
    navigateUpKeys?: string[];
    saveKey?: string;
}

export class InputManager {
    private boundOnKeyDown: ((event: KeyboardEvent) => void) | undefined;
    private boundOnPointerDown: ((event: PointerEvent) => void) | undefined;
    private canvas: HTMLCanvasElement | undefined;

    private config: Required<InputConfig>;
    private engine: Engine;

    private gamepadPollId: number | undefined;
    private prevGamepadAxes: number[] = [];
    private prevGamepadButtons: boolean[] = [];

    constructor(engine: Engine, config: InputConfig = {}) {
        this.engine = engine;
        this.config = {
            advanceKeys: ['Enter', ' '],
            backKeys: ['Escape'],
            confirmKeys: ['Enter', ' '],
            gamepadAdvanceButton: 0,
            gamepadBackButton: 1,
            gamepadConfirmButton: 0,
            gamepadDownButton: 13,
            gamepadLeftButton: 14,
            gamepadMenuButton: 9,
            gamepadRightButton: 15,
            gamepadUpButton: 12,
            loadKey: 'l',
            menuKey: 'Escape',
            navigateDownKeys: ['ArrowDown', 's', 'S'],
            navigateLeftKeys: ['ArrowLeft', 'a', 'A'],
            navigateRightKeys: ['ArrowRight', 'd', 'D'],
            navigateUpKeys: ['ArrowUp', 'w', 'W'],
            saveKey: 's',
            ...config
        };
    }

    public attach(canvas: HTMLCanvasElement) {
        if (this.canvas) {
            this.detach();
        }

        this.canvas = canvas;

        this.boundOnPointerDown = () => {
            if (this.engine.isStarted && !this.engine.overlay.isOpen) {
                this.engine.events.emit('input:next');
                this.engine.requestSkip();
                void this.engine.playNext();
            }
        };

        this.boundOnKeyDown = (event: KeyboardEvent) => {
            const isGameKey = [
                ...this.config.navigateUpKeys,
                ...this.config.navigateDownKeys,
                ...this.config.navigateLeftKeys,
                ...this.config.navigateRightKeys,
                ...this.config.advanceKeys
            ].includes(event.key);

            if (isGameKey) {
                // event.preventDefault();
            }

            // Navigation
            if (this.config.navigateUpKeys.includes(event.key)) {
                this.engine.events.emit('input:navigate', 'up');
            }
            if (this.config.navigateDownKeys.includes(event.key)) {
                this.engine.events.emit('input:navigate', 'down');
            }
            if (this.config.navigateLeftKeys.includes(event.key)) {
                this.engine.events.emit('input:navigate', 'left');
            }
            if (this.config.navigateRightKeys.includes(event.key)) {
                this.engine.events.emit('input:navigate', 'right');
            }

            // Confirm
            if (this.config.confirmKeys.includes(event.key)) {
                this.engine.events.emit('input:confirm');
            }

            // Back / Menu
            if (this.config.backKeys.includes(event.key)) {
                event.preventDefault();
                if (this.engine.overlay.isOpen) {
                    this.engine.events.emit('input:back');
                } else if (this.engine.isStarted) {
                    this.engine.events.emit('menu:toggle');
                }
                return;
            }

            // Start screen
            if (!this.engine.isStarted) {
                if (this.config.advanceKeys.includes(event.key)) {
                    event.preventDefault();
                    this.engine.events.emit('input:start');
                }
                return;
            }

            // Advance dialogue
            if (this.config.advanceKeys.includes(event.key)) {
                event.preventDefault();
                if (!this.engine.overlay.isOpen) {
                    this.engine.events.emit('input:next');
                    this.engine.requestSkip();
                    void this.engine.playNext();
                }
                return;
            }

            // Save/Load Shortcuts
            const key = event.key.toLowerCase();
            if (key === this.config.saveKey) {
                void this.engine.saves.save(1);
                this.engine.notifications.show('Game Saved!');
            } else if (key === this.config.loadKey) {
                void this.engine.saves.load(1);
                this.engine.notifications.show('Game Loaded!');
            }
        };

        // 3. Attach listeners
        canvas.addEventListener('pointerdown', this.boundOnPointerDown);
        globalThis.addEventListener('keydown', this.boundOnKeyDown);

        this.startGamepadPolling();
    }

    public detach() {
        if (this.canvas && this.boundOnPointerDown) {
            this.canvas.removeEventListener('pointerdown', this.boundOnPointerDown);
        }

        if (this.boundOnKeyDown) {
            globalThis.removeEventListener('keydown', this.boundOnKeyDown);
        }

        this.stopGamepadPolling();

        this.boundOnPointerDown = undefined;
        this.boundOnKeyDown = undefined;
        this.canvas = undefined;
    }

    private startGamepadPolling() {
        this.stopGamepadPolling();

        const poll = () => {
            const gamepad = navigator.getGamepads()[0];
            if (gamepad) {
                const buttons = gamepad.buttons.map(b => b.pressed);
                const axes = [...gamepad.axes];

                const pressed = (button: number) => buttons[button] && !this.prevGamepadButtons[button];

                // D-pad buttons
                if (pressed(this.config.gamepadUpButton)) this.engine.events.emit('input:navigate', 'up');
                if (pressed(this.config.gamepadDownButton)) this.engine.events.emit('input:navigate', 'down');
                if (pressed(this.config.gamepadLeftButton)) this.engine.events.emit('input:navigate', 'left');
                if (pressed(this.config.gamepadRightButton)) this.engine.events.emit('input:navigate', 'right');

                // Axes
                const stickY = axes[1] ?? 0;
                const previousStickY = this.prevGamepadAxes[1] ?? 0;
                if (stickY < -0.5 && previousStickY >= -0.5) this.engine.events.emit('input:navigate', 'up');
                if (stickY > 0.5 && previousStickY <= 0.5) this.engine.events.emit('input:navigate', 'down');

                const stickX = axes[0] ?? 0;
                const previousStickX = this.prevGamepadAxes[0] ?? 0;
                if (stickX < -0.5 && previousStickX >= -0.5) this.engine.events.emit('input:navigate', 'left');
                if (stickX > 0.5 && previousStickX <= 0.5) this.engine.events.emit('input:navigate', 'right');

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
                        void this.engine.playNext();
                    } else if (!this.engine.isStarted) {
                        this.engine.events.emit('input:start');
                    }
                }

                if (pressed(this.config.gamepadMenuButton) && this.engine.isStarted) {
                        if (this.engine.overlay.isOpen) this.engine.events.emit('input:back');
                        else this.engine.events.emit('menu:toggle');
                    }

                this.prevGamepadButtons = buttons;
                this.prevGamepadAxes = axes;
            }
            this.gamepadPollId = requestAnimationFrame(poll);
        };
        this.gamepadPollId = requestAnimationFrame(poll);
    }

    private stopGamepadPolling() {
        if (this.gamepadPollId !== undefined) {
            cancelAnimationFrame(this.gamepadPollId);
            this.gamepadPollId = undefined;
        }
    }
}
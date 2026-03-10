import type { IEventBus } from '../interfaces/managers';

export interface IInputContext {
    isOverlayOpen(): boolean;
    isStarted(): boolean;
}

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

    private readonly config: Required<InputConfig>;
    private readonly context: IInputContext;
    private readonly events: IEventBus;

    private gamepadPollId: number | undefined;
    private isPolling = false;
    private prevGamepadAxes: number[] = [];
    private prevGamepadButtons: boolean[] = [];

    constructor(events: IEventBus, context: IInputContext, config: InputConfig = {}) {
        this.context = context;
        this.events = events;
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
            if (this.context.isStarted() && !this.context.isOverlayOpen()) {
                this.events.emit('input:skip');
                this.events.emit('input:next');
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
                this.events.emit('input:navigate', 'up');
            }
            if (this.config.navigateDownKeys.includes(event.key)) {
                this.events.emit('input:navigate', 'down');
            }
            if (this.config.navigateLeftKeys.includes(event.key)) {
                this.events.emit('input:navigate', 'left');
            }
            if (this.config.navigateRightKeys.includes(event.key)) {
                this.events.emit('input:navigate', 'right');
            }

            // Confirm
            if (this.config.confirmKeys.includes(event.key)) {
                this.events.emit('input:confirm');
            }

            // Back / Menu
            if (this.config.backKeys.includes(event.key)) {
                event.preventDefault();
                if (this.context.isOverlayOpen()) {
                    this.events.emit('input:back');
                } else if (this.context.isStarted()) {
                    this.events.emit('menu:toggle');
                }
                return;
            }

            // Start screen
            if (!this.context.isStarted()) {
                if (this.config.advanceKeys.includes(event.key)) {
                    event.preventDefault();
                    this.events.emit('input:start');
                }
                return;
            }

            // Advance dialogue
            if (this.config.advanceKeys.includes(event.key)) {
                event.preventDefault();
                if (!this.context.isOverlayOpen()) {
                    this.events.emit('input:skip');
                    this.events.emit('input:next');
                }
                return;
            }

            // Save/Load Shortcuts
            const key = event.key.toLowerCase();
            if (key === this.config.saveKey) {
                this.events.emit('input:save', 1);
            } else if (key === this.config.loadKey) {
                this.events.emit('input:load', 1);
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
        this.isPolling = true;

        const poll = () => {
            if (!this.isPolling) return;

            const gamepad = navigator.getGamepads()[0];
            if (gamepad) {
                const buttons = gamepad.buttons.map(b => b.pressed);
                const axes = [...gamepad.axes];

                const pressed = (button: number) => buttons[button] && !this.prevGamepadButtons[button];

                // D-pad buttons
                if (pressed(this.config.gamepadUpButton)) this.events.emit('input:navigate', 'up');
                if (pressed(this.config.gamepadDownButton)) this.events.emit('input:navigate', 'down');
                if (pressed(this.config.gamepadLeftButton)) this.events.emit('input:navigate', 'left');
                if (pressed(this.config.gamepadRightButton)) this.events.emit('input:navigate', 'right');

                // Axes
                const stickY = axes[1] ?? 0;
                const previousStickY = this.prevGamepadAxes[1] ?? 0;
                if (stickY < -0.5 && previousStickY >= -0.5) this.events.emit('input:navigate', 'up');
                if (stickY > 0.5 && previousStickY <= 0.5) this.events.emit('input:navigate', 'down');

                const stickX = axes[0] ?? 0;
                const previousStickX = this.prevGamepadAxes[0] ?? 0;
                if (stickX < -0.5 && previousStickX >= -0.5) this.events.emit('input:navigate', 'left');
                if (stickX > 0.5 && previousStickX <= 0.5) this.events.emit('input:navigate', 'right');

                // Buttons
                if (pressed(this.config.gamepadConfirmButton)) this.events.emit('input:confirm');

                if (pressed(this.config.gamepadBackButton)) {
                    if (this.context.isOverlayOpen()) this.events.emit('input:back');
                    else if (this.context.isStarted()) this.events.emit('menu:toggle');
                }

                if (pressed(this.config.gamepadAdvanceButton)) {
                    if (this.context.isStarted() && !this.context.isOverlayOpen()) {
                        this.events.emit('input:skip');
                        this.events.emit('input:next');
                    } else if (!this.context.isStarted()) {
                        this.events.emit('input:start');
                    }
                }

                if (pressed(this.config.gamepadMenuButton) && this.context.isStarted()) {
                    if (this.context.isOverlayOpen()) this.events.emit('input:back');
                    else this.events.emit('menu:toggle');
                }

                this.prevGamepadButtons = buttons;
                this.prevGamepadAxes = axes;
            }
            this.gamepadPollId = requestAnimationFrame(poll);
        };
        this.gamepadPollId = requestAnimationFrame(poll);
    }

    private stopGamepadPolling() {
        this.isPolling = false;
        if (this.gamepadPollId !== undefined) {
            cancelAnimationFrame(this.gamepadPollId);
            this.gamepadPollId = undefined;
        }
    }
}
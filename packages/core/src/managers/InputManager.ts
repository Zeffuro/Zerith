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
            if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey
                || isFormTarget(event.target) || isFormTarget(globalThis.document?.activeElement)) return;

            const overlayOpen = this.context.isOverlayOpen();
            const started = this.context.isStarted();
            if ((overlayOpen && this.config.backKeys.includes(event.key)) || event.key === this.config.menuKey) {
                event.preventDefault();
                if (event.repeat) return;
                if (overlayOpen) {
                    this.events.emit('input:back');
                } else if (started && event.key === this.config.menuKey) {
                    this.events.emit('menu:toggle');
                }
                return;
            }

            if (!started) {
                if (this.config.advanceKeys.includes(event.key)) {
                    event.preventDefault();
                    if (!event.repeat) this.events.emit('input:start');
                }
                return;
            }

            const directions = [
                ['up', this.config.navigateUpKeys],
                ['down', this.config.navigateDownKeys],
                ['left', this.config.navigateLeftKeys],
                ['right', this.config.navigateRightKeys],
            ] as const;
            const navigation = directions.find(([, keys]) => keys.includes(event.key));
            if (navigation) {
                event.preventDefault();
                this.events.emit('input:navigate', navigation[0]);
                if (overlayOpen) return;
            }
            if (this.config.confirmKeys.includes(event.key)) {
                event.preventDefault();
                this.events.emit('input:confirm');
                if (overlayOpen) return;
            }
            if (overlayOpen) return;

            if (this.config.advanceKeys.includes(event.key)) {
                event.preventDefault();
                this.events.emit('input:skip');
                this.events.emit('input:next');
                return;
            }

            const key = event.key.toLowerCase();
            if (event.repeat) return;
            if (key === this.config.saveKey.toLowerCase()) {
                event.preventDefault();
                this.events.emit('input:save', 1);
            } else if (key === this.config.loadKey.toLowerCase()) {
                event.preventDefault();
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
        const gamepad = navigator.getGamepads()[0];
        this.prevGamepadButtons = gamepad?.buttons.map(button => button.pressed) ?? [];
        this.prevGamepadAxes = gamepad ? [...gamepad.axes] : [];
        this.isPolling = true;

        const poll = () => {
            if (!this.isPolling) return;

            const gamepad = navigator.getGamepads()[0];
            if (gamepad) {
                const buttons = gamepad.buttons.map(b => b.pressed);
                const axes = [...gamepad.axes];

                const pressed = (button: number) => buttons[button] && !this.prevGamepadButtons[button];
                const overlayOpen = this.context.isOverlayOpen();
                const started = this.context.isStarted();

                const stickY = axes[1] ?? 0;
                const previousStickY = this.prevGamepadAxes[1] ?? 0;
                const stickX = axes[0] ?? 0;
                const previousStickX = this.prevGamepadAxes[0] ?? 0;
                const menuPressed = pressed(this.config.gamepadBackButton) || pressed(this.config.gamepadMenuButton);
                const navigation = [
                    ['up', pressed(this.config.gamepadUpButton) || (stickY < -0.5 && previousStickY >= -0.5)],
                    ['down', pressed(this.config.gamepadDownButton) || (stickY > 0.5 && previousStickY <= 0.5)],
                    ['left', pressed(this.config.gamepadLeftButton) || (stickX < -0.5 && previousStickX >= -0.5)],
                    ['right', pressed(this.config.gamepadRightButton) || (stickX > 0.5 && previousStickX <= 0.5)],
                ] as const;
                if (!isFormTarget(globalThis.document?.activeElement)) {
                    if (menuPressed && (started || overlayOpen)) {
                        this.events.emit(overlayOpen ? 'input:back' : 'menu:toggle');
                    } else {
                        const direction = navigation.find(([, active]) => active);
                        if (direction) this.events.emit('input:navigate', direction[0]);
                        if (!(direction && overlayOpen) && pressed(this.config.gamepadConfirmButton) && started) {
                            this.events.emit('input:confirm');
                        }
                        if (pressed(this.config.gamepadAdvanceButton) && !overlayOpen) {
                            if (started) {
                                this.events.emit('input:skip');
                                this.events.emit('input:next');
                            } else {
                                this.events.emit('input:start');
                            }
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
        this.isPolling = false;
        if (this.gamepadPollId !== undefined) {
            cancelAnimationFrame(this.gamepadPollId);
            this.gamepadPollId = undefined;
        }
    }
}

function isFormTarget(target: EventTarget | null | undefined): boolean {
    if (!target || !('closest' in target) || typeof target.closest !== 'function') return false;
    const element = target as Element;
    return Boolean(element.closest('input, textarea, select, button, [contenteditable]:not([contenteditable="false"])'));
}

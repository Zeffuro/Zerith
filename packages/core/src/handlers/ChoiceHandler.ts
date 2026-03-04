import { Container, Graphics, Text, type TextStyleOptions } from 'pixi.js';
import type { BaseCommand, CommandHandler } from '../types';
import type { Engine } from '../Engine';

export interface ChoiceOption {
    label: string;
    commands?: BaseCommand[];
}

export interface ChoiceCommand extends BaseCommand {
    type: 'choice';
    options: ChoiceOption[];
}

export interface ChoiceConfig {
    backgroundColor?: number;
    backgroundAlpha?: number;
    selectedBackgroundColor?: number;
    selectedBackgroundAlpha?: number;
    borderColor?: number;
    selectedBorderColor?: number;
    borderWidth?: number;
    textStyle?: Partial<TextStyleOptions>;
}

export class ChoiceHandler implements CommandHandler<ChoiceCommand> {
    public type = 'choice';
    public autoNext = true;
    private config: Required<ChoiceConfig>;

    constructor(config: ChoiceConfig = {}) {
        this.config = {
            backgroundColor: 0x000000,
            backgroundAlpha: 0.8,
            selectedBackgroundColor: 0x333399,
            selectedBackgroundAlpha: 0.95,
            borderColor: 0xffffff,
            selectedBorderColor: 0xffaaaa,
            borderWidth: 2,
            textStyle: {},
            ...config
        };
    }

    execute = (command: ChoiceCommand, engine: Engine): Promise<void> => {
        return new Promise((resolve) => {
            const choiceContainer = new Container();

            const w = engine.display.width;
            const h = engine.display.height;

            const buttonWidth = Math.min(600, w * 0.75);
            const buttonHeight = 60;
            const spacing = 15;
            const totalHeight = command.options.length * (buttonHeight + spacing);
            let currentY = (h / 2) - (totalHeight / 2);

            let selectedIndex = 0;
            const buttons: Container[] = [];
            const backgrounds: Graphics[] = [];

            const updateSelection = (newIndex: number) => {
                if (newIndex < 0) newIndex = command.options.length - 1;
                if (newIndex >= command.options.length) newIndex = 0;

                this.styleButton(backgrounds[selectedIndex], buttonWidth, buttonHeight, false);
                buttons[selectedIndex].alpha = 1.0;

                selectedIndex = newIndex;
                this.styleButton(backgrounds[selectedIndex], buttonWidth, buttonHeight, true);
                buttons[selectedIndex].alpha = 1.0;
            };

            const confirmSelection = () => {
                cleanup();
                choiceContainer.destroy({ children: true });

                const option = command.options[selectedIndex];
                if (option.commands) {
                    engine.injectCommands(option.commands);
                }
                requestAnimationFrame(() => {
                    engine.consumeSkip();
                    resolve();
                });
            };

            command.options.forEach((option, index) => {
                const btn = new Container();
                btn.eventMode = 'static';
                btn.cursor = 'pointer';

                const bg = new Graphics();
                this.styleButton(bg, buttonWidth, buttonHeight, index === 0);
                backgrounds.push(bg);

                const text = new Text({
                    text: option.label,
                    style: {
                        fontFamily: 'Arial',
                        fill: 0xffffff,
                        fontSize: 24,
                        align: 'center',
                        ...this.config.textStyle
                    }
                });
                text.anchor.set(0.5);
                text.position.set(buttonWidth / 2, buttonHeight / 2);

                btn.addChild(bg, text);
                btn.position.set((w / 2) - (buttonWidth / 2), currentY);

                btn.on('pointerover', () => {
                    updateSelection(index);
                });

                btn.on('pointerdown', (e: any) => {
                    e.stopPropagation();
                    selectedIndex = index;
                    confirmSelection();
                });

                buttons.push(btn);
                choiceContainer.addChild(btn);
                currentY += buttonHeight + spacing;
            });

            // Keyboard handling
            const onKeyDown = (e: KeyboardEvent) => {
                switch (e.key) {
                    case 'ArrowUp':
                    case 'w':
                    case 'W':
                        e.preventDefault();
                        updateSelection(selectedIndex - 1);
                        break;
                    case 'ArrowDown':
                    case 's':
                    case 'S':
                        e.preventDefault();
                        updateSelection(selectedIndex + 1);
                        break;
                    case 'Enter':
                    case ' ':
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        confirmSelection();
                        break;
                }
            };
            window.addEventListener('keydown', onKeyDown);

            // Gamepad handling
            let prevDpadUp = false;
            let prevDpadDown = false;
            let prevConfirm = false;
            let gamepadPollId: number | null = null;

            const pollGamepad = () => {
                const gamepad = navigator.getGamepads()[0];
                if (gamepad) {
                    const dpadUp = gamepad.buttons[12]?.pressed || gamepad.axes[1] < -0.5;
                    const dpadDown = gamepad.buttons[13]?.pressed || gamepad.axes[1] > 0.5;
                    const confirm = gamepad.buttons[0]?.pressed ?? false;

                    if (dpadUp && !prevDpadUp) updateSelection(selectedIndex - 1);
                    if (dpadDown && !prevDpadDown) updateSelection(selectedIndex + 1);
                    if (confirm && !prevConfirm) confirmSelection();

                    prevDpadUp = dpadUp;
                    prevDpadDown = dpadDown;
                    prevConfirm = confirm;
                }
                gamepadPollId = requestAnimationFrame(pollGamepad);
            };
            gamepadPollId = requestAnimationFrame(pollGamepad);

            const cleanup = () => {
                window.removeEventListener('keydown', onKeyDown);
                if (gamepadPollId !== null) {
                    cancelAnimationFrame(gamepadPollId);
                    gamepadPollId = null;
                }
            };

            engine.layers.ui.addChild(choiceContainer);
        });
    };

    private styleButton(bg: Graphics, w: number, h: number, selected: boolean) {
        bg.clear();
        bg.roundRect(0, 0, w, h, 10);
        bg.fill({
            color: selected ? this.config.selectedBackgroundColor : this.config.backgroundColor,
            alpha: selected ? this.config.selectedBackgroundAlpha : this.config.backgroundAlpha
        });
        if (this.config.borderWidth > 0) {
            bg.stroke({
                color: selected ? this.config.selectedBorderColor : this.config.borderColor,
                width: this.config.borderWidth
            });
        }
    }
}
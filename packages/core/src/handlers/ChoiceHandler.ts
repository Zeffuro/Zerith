import { Container, FederatedPointerEvent, Graphics, Text, type TextStyleOptions } from 'pixi.js';

import type { Engine } from '../Engine';
import type { BaseCommand, CommandHandler } from '../types';

export interface ChoiceCommand extends BaseCommand {
    options: ChoiceOption[];
    type: 'choice';
}

export interface ChoiceConfig {
    backgroundAlpha?: number;
    backgroundColor?: number;
    borderColor?: number;
    borderWidth?: number;
    selectedBackgroundAlpha?: number;
    selectedBackgroundColor?: number;
    selectedBorderColor?: number;
    textStyle?: Partial<TextStyleOptions>;
}

export interface ChoiceOption {
    commands?: BaseCommand[];
    label: string;
}

export class ChoiceHandler implements CommandHandler<ChoiceCommand> {
    public autoNext = true;
    public type = 'choice' as const;
    private config: Required<ChoiceConfig>;

    constructor(config: ChoiceConfig = {}) {
        this.config = {
            backgroundAlpha: 0.8,
            backgroundColor: 0x00_00_00,
            borderColor: 0xFF_FF_FF,
            borderWidth: 2,
            selectedBackgroundAlpha: 0.95,
            selectedBackgroundColor: 0x33_33_99,
            selectedBorderColor: 0xFF_AA_AA,
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
                buttons[selectedIndex].alpha = 1;

                selectedIndex = newIndex;
                this.styleButton(backgrounds[selectedIndex], buttonWidth, buttonHeight, true);
                buttons[selectedIndex].alpha = 1;
            };

            const confirmSelection = () => {
                cleanup();
                choiceContainer.destroy({ children: true });

                const option = command.options[selectedIndex];
                if (option.commands) {
                    engine.scenes.injectCommands(option.commands);
                }
                requestAnimationFrame(() => {
                    engine.consumeSkip();
                    resolve();
                });
            };

            for (const [index, option] of command.options.entries()) {
                const button = new Container();
                button.eventMode = 'static';
                button.cursor = 'pointer';

                const bg = new Graphics();
                this.styleButton(bg, buttonWidth, buttonHeight, index === 0);
                backgrounds.push(bg);

                const text = new Text({
                    style: {
                        align: 'center',
                        fill: 0xFF_FF_FF,
                        fontFamily: engine.theme.fontFamily,
                        fontSize: engine.theme.fontSize,
                        ...this.config.textStyle
                    },
                    text: option.label
                });
                text.anchor.set(0.5);
                text.position.set(buttonWidth / 2, buttonHeight / 2);

                button.addChild(bg, text);
                button.position.set((w / 2) - (buttonWidth / 2), currentY);

                button.on('pointerover', () => {
                    updateSelection(index);
                });

                button.on('pointerdown', (event: FederatedPointerEvent) => {
                    event.stopPropagation();
                    selectedIndex = index;
                    confirmSelection();
                });

                buttons.push(button);
                choiceContainer.addChild(button);
                currentY += buttonHeight + spacing;
            }

            // Subscribe to InputManager events
            const onNavigate = (navigationArgument: unknown) => {
                const direction = navigationArgument as string;
                if (direction === 'up') updateSelection(selectedIndex - 1);
                if (direction === 'down') updateSelection(selectedIndex + 1);
            };

            const onConfirm = () => {
                confirmSelection();
            };

            engine.events.on('input:navigate', onNavigate);
            engine.events.on('input:confirm', onConfirm);

            const cleanup = () => {
                engine.events.off('input:navigate', onNavigate);
                engine.events.off('input:confirm', onConfirm);
            };

            engine.layers.ui.addChild(choiceContainer);
        });
    };

    private styleButton(bg: Graphics, w: number, h: number, selected: boolean) {
        bg.clear();
        bg.roundRect(0, 0, w, h, 10);
        bg.fill({
            alpha: selected ? this.config.selectedBackgroundAlpha : this.config.backgroundAlpha,
            color: selected ? this.config.selectedBackgroundColor : this.config.backgroundColor
        });
        if (this.config.borderWidth > 0) {
            bg.stroke({
                color: selected ? this.config.selectedBorderColor : this.config.borderColor,
                width: this.config.borderWidth
            });
        }
    }
}
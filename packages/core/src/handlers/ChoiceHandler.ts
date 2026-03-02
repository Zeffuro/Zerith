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
    borderColor?: number;
    borderWidth?: number;
    textStyle?: Partial<TextStyleOptions>;
}

export class ChoiceHandler implements CommandHandler<ChoiceCommand> {
    public type = 'choice';
    public autoNext = true;
    private config: ChoiceConfig;

    constructor(config: ChoiceConfig = {}) {
        this.config = {
            backgroundColor: 0x000000,
            backgroundAlpha: 0.8,
            borderColor: 0xffffff,
            borderWidth: 2,
            ...config
        };
    }

    execute = (command: ChoiceCommand, engine: Engine): Promise<void> => {
        return new Promise((resolve) => {
            const choiceContainer = new Container();

            const buttonWidth = 600;
            const buttonHeight = 60;
            const spacing = 15;
            const totalHeight = command.options.length * (buttonHeight + spacing);
            let currentY = (engine.app.screen.height / 2) - (totalHeight / 2);

            command.options.forEach((option) => {
                const btn = new Container();
                btn.eventMode = 'static';
                btn.cursor = 'pointer';

                const bg = new Graphics();
                bg.roundRect(0, 0, buttonWidth, buttonHeight, 10);
                bg.fill({ color: this.config.backgroundColor, alpha: this.config.backgroundAlpha });

                if (this.config.borderWidth! > 0) {
                    bg.stroke({ color: this.config.borderColor, width: this.config.borderWidth });
                }

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
                btn.position.set((engine.app.screen.width / 2) - (buttonWidth / 2), currentY);

                btn.on('pointerover', () => { btn.alpha = 0.7; });
                btn.on('pointerout', () => { btn.alpha = 1.0; });

                btn.on('pointerdown', async () => {
                    choiceContainer.eventMode = 'none';
                    choiceContainer.destroy();

                    if (option.commands) {
                        engine.injectCommands(option.commands);
                    }
                    resolve();
                });

                choiceContainer.addChild(btn);
                currentY += buttonHeight + spacing;
            });

            engine.layers.ui.addChild(choiceContainer);
        });
    };
}
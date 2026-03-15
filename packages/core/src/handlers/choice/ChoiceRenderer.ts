import { Container, type FederatedPointerEvent, Graphics, Text, type TextStyleOptions } from 'pixi.js';

import type { IDisplayManager } from '../../interfaces/managers';

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
    label: string;
}

export class ChoiceRenderer {
    private activeChoiceContainer: Container | undefined;
    private readonly config: Required<ChoiceConfig>;
    private readonly display: IDisplayManager;
    private readonly optionBackgrounds: Graphics[] = [];
    private readonly optionButtons: Container[] = [];
    private readonly optionSizes: Array<{ height: number; width: number }> = [];

    constructor(display: IDisplayManager, config: Required<ChoiceConfig>) {
        this.display = display;
        this.config = config;
    }

    public create(
        options: ChoiceOption[],
        onHover: (index: number) => void,
        onSelect: (index: number) => void,
    ): Container {
        this.destroy();

        const choiceContainer = new Container();
        this.activeChoiceContainer = choiceContainer;
        this.optionBackgrounds.length = 0;
        this.optionButtons.length = 0;
        this.optionSizes.length = 0;

        const width = this.display.width;
        const height = this.display.height;
        const buttonWidth = Math.min(600, width * 0.75);
        const buttonHeight = 60;
        const spacing = 15;
        const totalHeight = options.length * (buttonHeight + spacing);
        let currentY = (height / 2) - (totalHeight / 2);

        for (const [index, option] of options.entries()) {
            const button = new Container();
            button.eventMode = 'static';
            button.cursor = 'pointer';

            const background = new Graphics();
            this.styleButton(background, buttonWidth, buttonHeight, index === 0);
            this.optionBackgrounds.push(background);
            this.optionSizes.push({ height: buttonHeight, width: buttonWidth });

            const text = new Text({
                style: {
                    align: 'center',
                    fill: 0xFF_FF_FF,
                    fontFamily: 'Arial',
                    fontSize: 28,
                    ...this.config.textStyle
                },
                text: option.label
            });
            text.anchor.set(0.5);
            text.position.set(buttonWidth / 2, buttonHeight / 2);

            button.addChild(background, text);
            button.position.set((width / 2) - (buttonWidth / 2), currentY);

            button.on('pointerover', () => {
                onHover(index);
            });

            button.on('pointerdown', (event: FederatedPointerEvent) => {
                event.stopPropagation();
                onSelect(index);
            });

            this.optionButtons.push(button);
            choiceContainer.addChild(button);
            currentY += buttonHeight + spacing;
        }

        this.display.getLayer('ui').addChild(choiceContainer);
        return choiceContainer;
    }

    public destroy(): void {
        if (this.activeChoiceContainer && !this.activeChoiceContainer.destroyed) {
            this.activeChoiceContainer.destroy({ children: true });
        }
        this.activeChoiceContainer = undefined;
        this.optionBackgrounds.length = 0;
        this.optionButtons.length = 0;
        this.optionSizes.length = 0;
    }

    public setSelected(index: number): void {
        for (const [currentIndex, background] of this.optionBackgrounds.entries()) {
            const size = this.optionSizes[currentIndex];
            if (!size) continue;
            this.styleButton(background, size.width, size.height, currentIndex === index);
        }

        for (const button of this.optionButtons) {
            button.alpha = 1;
        }
    }

    private styleButton(background: Graphics, width: number, height: number, selected: boolean): void {
        background.clear();
        background.roundRect(0, 0, width, height, 10);
        background.fill({
            alpha: selected ? this.config.selectedBackgroundAlpha : this.config.backgroundAlpha,
            color: selected ? this.config.selectedBackgroundColor : this.config.backgroundColor
        });
        if (this.config.borderWidth > 0) {
            background.stroke({
                color: selected ? this.config.selectedBorderColor : this.config.borderColor,
                width: this.config.borderWidth
            });
        }
    }
}


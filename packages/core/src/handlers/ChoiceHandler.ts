import type { IDisplayManager, IEventBus, IFlowManager, NavigationDirection } from '../interfaces/managers';
import type { BaseCommand, CommandHandler } from '../types';

import { type ChoiceConfig, ChoiceRenderer } from './choice/ChoiceRenderer';

export interface ChoiceCommand extends BaseCommand {
    options: ChoiceOption[];
    type: 'choice';
}

export interface ChoiceOption {
    commands?: BaseCommand[];
    label: string;
}


export class ChoiceHandler implements CommandHandler<ChoiceCommand> {
    public autoNext = true;
    public type = 'choice' as const;
    private activeResolve: (() => void) | undefined;
    private readonly events: IEventBus;
    private readonly flow: IFlowManager;
    private onConfirm: (() => void) | undefined;
    private onNavigate: ((direction: NavigationDirection) => void) | undefined;
    private readonly renderer: ChoiceRenderer;

    constructor(
        display: IDisplayManager,
        events: IEventBus,
        flow: IFlowManager,
        config: ChoiceConfig = {},
    ) {
        this.events = events;
        this.flow = flow;
        const resolvedConfig: Required<ChoiceConfig> = {
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
        this.renderer = new ChoiceRenderer(display, resolvedConfig);
    }

    public destroy(): void {
        this.reset();
    }

    execute = (command: ChoiceCommand): Promise<void> => {
        return new Promise((resolve) => {
            this.reset();
            this.activeResolve = resolve;

            let selectedIndex = 0;

            const updateSelection = (newIndex: number) => {
                if (newIndex < 0) newIndex = command.options.length - 1;
                if (newIndex >= command.options.length) newIndex = 0;
                selectedIndex = newIndex;
                this.renderer.setSelected(selectedIndex);
            };

            const confirmSelection = () => {
                this.clearChoiceBindings();
                this.renderer.destroy();

                const option = command.options[selectedIndex];
                if (option.commands) {
                    this.flow.injectCommands(option.commands);
                }
                requestAnimationFrame(() => {
                    this.flow.consumeSkip();
                    this.activeResolve = undefined;
                    resolve();
                });
            };

            this.renderer.create(
                command.options,
                (index) => updateSelection(index),
                (index) => {
                    selectedIndex = index;
                    confirmSelection();
                },
            );
            this.renderer.setSelected(selectedIndex);

            // Subscribe to InputManager events
            this.onNavigate = (direction: NavigationDirection) => {
                if (direction === 'up') updateSelection(selectedIndex - 1);
                if (direction === 'down') updateSelection(selectedIndex + 1);
            };

            this.onConfirm = () => {
                confirmSelection();
            };

            this.events.on('input:navigate', this.onNavigate);
            this.events.on('input:confirm', this.onConfirm);
        });
    };

    public reset(): void {
        this.clearChoiceBindings();
        this.renderer.destroy();
        if (this.activeResolve) {
            this.activeResolve();
            this.activeResolve = undefined;
        }
    }

    private clearChoiceBindings(): void {
        if (this.onNavigate) {
            this.events.off('input:navigate', this.onNavigate);
            this.onNavigate = undefined;
        }
        if (this.onConfirm) {
            this.events.off('input:confirm', this.onConfirm);
            this.onConfirm = undefined;
        }
    }
}
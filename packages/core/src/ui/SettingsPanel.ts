import { Graphics } from "pixi.js";

import type { DialogueHandler } from '../handlers/DialogueHandler';
import type { IAudioManager } from '../interfaces/managers';
import type { MenuPanel } from '../types';
import type { SliderResult, ToggleResult } from './UIComponents';
import type { UIVisualContext } from './UIRenderContext';

import { createButton, createPanelTitle, createSlider, createToggle, registerFocusableButton } from './UIComponents';

export class SettingsPanel implements MenuPanel {
    public id = 'settings';
    public label = 'Settings';
    private readonly audio: IAudioManager;
    private readonly dialogueHandler: DialogueHandler;

    constructor(
        audio: IAudioManager,
        dialogueHandler: DialogueHandler,
    ) {
        this.audio = audio;
        this.dialogueHandler = dialogueHandler;
    }

    build(visualContext: UIVisualContext, onClose: () => void) {
        const context = {
            canvasHeight: visualContext.canvasHeight,
            canvasWidth: visualContext.canvasWidth,
            getCanvasRect: () => visualContext.canvasElement.getBoundingClientRect(),
            overlayConfig: visualContext.overlayConfig,
            theme: visualContext.theme,
        };
        const cfg = context.overlayConfig;
        const focus = visualContext.focus;

        const root = visualContext.createPanelBase();
        root.addChild(createPanelTitle(context, 'SETTINGS'));

        const contentStartX = (context.canvasWidth - 400 - 180 - 80) / 2;
        let yPos = 100;
        const spacing = 70;
        const cleanups: (() => void)[] = [];

        const createFocusIndicator = (atY: number): Graphics => {
            const indicator = new Graphics();
            indicator.roundRect(contentStartX - 15, atY, 4, 40, 2);
            indicator.fill({ alpha: 0.9, color: context.theme.accentColor });
            indicator.visible = false;
            root.addChild(indicator);
            return indicator;
        };

        const sliderDefs: { getValue: () => number; label: string; setValue: (v: number) => void }[] = [
            { getValue: () => this.audio.masterVolume, label: 'Master Volume', setValue: (v) => this.audio.setMasterVolume(v) },
            { getValue: () => this.audio.bgmVolume, label: 'BGM Volume', setValue: (v) => this.audio.setVolume('bgm', v) },
            { getValue: () => this.audio.sfxVolume, label: 'SFX Volume', setValue: (v) => this.audio.setVolume('sfx', v) },
            { getValue: () => this.audio.voiceVolume, label: 'Voice Volume', setValue: (v) => this.audio.setVolume('voice', v) },
        ];

        const sliderResults: SliderResult[] = [];

        for (const { getValue, label, setValue } of sliderDefs) {
            const result = createSlider(context, {
                label,
                onChange: setValue,
                value: getValue(),
            });
            result.container.position.set(contentStartX, yPos);
            root.addChild(result.container);
            cleanups.push(result.cleanup);
            sliderResults.push(result);

            focus.register({
                activate: () => {},
                blur: () => {},
                focus: () => {},
            });

            yPos += spacing;
        }

        yPos += 10;
        const toggleResult: ToggleResult = createToggle(context, {
            label: 'Auto-Advance',
            onChange: (on) => this.dialogueHandler.setAutoAdvanceDelay(on ? 3000 : undefined),
            value: this.dialogueHandler.getAutoAdvanceDelay() !== undefined,
        });
        toggleResult.container.position.set(contentStartX, yPos);
        root.addChild(toggleResult.container);

        // ── Dialogue Font Size ──
        yPos += spacing;
        const fontSizeSlider = createSlider(context, {
            label: 'Text Size',
            onChange: (v) => {
                visualContext.theme.fontSize = Math.round(14 + v * 26);
                this.dialogueHandler.reset?.();
            },
            value: (visualContext.theme.fontSize - 14) / 26,
        });
        fontSizeSlider.container.position.set(contentStartX, yPos);
        root.addChild(fontSizeSlider.container);
        cleanups.push(fontSizeSlider.cleanup);
        sliderResults.push(fontSizeSlider);

        const fontSizeIndicator = createFocusIndicator(yPos);
        focus.register({
            activate: () => {},
            blur: () => { fontSizeIndicator.visible = false; },
            focus: () => { fontSizeIndicator.visible = true; },
        });

        const backMargin = 20;
        const backButton = createButton(context, {
            label: 'Back',
            x: context.canvasWidth / 2,
            y: context.canvasHeight - cfg.buttonHeight - backMargin,
        }, onClose);
        root.addChild(backButton);

        registerFocusableButton(context, focus, backButton, onClose);

        const sliderStep = 0.05;
        focus.onNavigateRaw = (direction: 'down' | 'left' | 'right' | 'up') => {
            const index = focus.selectedIndex;
            const sliderFocusMap: Record<number, number> = {
                0: 0, 1: 1, 2: 2, 3: 3,
                5: 4,
            };
            if (index in sliderFocusMap) {
                const sIndex = sliderFocusMap[index];
                if (direction === 'left') {
                    const s = sliderResults[sIndex];
                    s.applyValue(s.getValue() - sliderStep);
                    return true;
                }
                if (direction === 'right') {
                    const s = sliderResults[sIndex];
                    s.applyValue(s.getValue() + sliderStep);
                    return true;
                }
            }
            return false;
        };

        return {
            cleanup: () => { for (const function_ of cleanups) function_() },
            container: root,
        };
    }
}
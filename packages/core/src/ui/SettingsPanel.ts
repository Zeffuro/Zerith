import { Container, type FederatedPointerEvent, Graphics } from 'pixi.js';

import type { IAudioManager } from '../interfaces/managers';
import type { MenuPanel, PanelBuildDeps } from '../types';
import type { SliderResult, ToggleResult } from './UIComponents';

import { DEFAULT_TYPEWRITER_SPEED_MS, type DialogueHandler, MAX_TYPEWRITER_SPEED_MS } from '../handlers/DialogueHandler';
import { createButton, createPanelTitle, createSlider, createToggle, registerFocusableButton } from './UIComponents';

const TEXT_SIZE_MIN = 14;
const TEXT_SIZE_MAX = 40;
const SLIDER_STEP = 0.05;
const SETTINGS_ROW_SPACING = 56;

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

    build(deps: PanelBuildDeps) {
        const { display, focus, onClose, overlayConfig, theme } = deps;
        const cfg = overlayConfig;

        const container = new Container();
        container.eventMode = 'static';
        const bg = new Graphics()
            .rect(0, 0, display.width, display.height)
            .fill({ alpha: 0.95, color: cfg.backgroundColor });
        bg.eventMode = 'static';
        bg.on('pointerdown', (event: FederatedPointerEvent) => event.stopPropagation());
        container.addChild(bg);
        container.addChild(createPanelTitle(cfg, display.width, 'SETTINGS'));

        const contentStartX = (display.width - 400 - 180 - 80) / 2;
        let yPos = 90;
        const spacing = SETTINGS_ROW_SPACING;

        const createFocusIndicator = (atY: number): Graphics => {
            const indicator = new Graphics();
            indicator.roundRect(contentStartX - 15, atY, 4, 40, 2);
            indicator.fill({ alpha: 0.9, color: theme.accentColor });
            indicator.visible = false;
            container.addChild(indicator);
            return indicator;
        };

        const registerFocusableRow = (atY: number, activate: () => void = () => {}) => {
            const indicator = createFocusIndicator(atY);
            focus.register({
                activate,
                blur: () => { indicator.visible = false; },
                focus: () => { indicator.visible = true; },
            });
        };

        const sliderDefs: { getValue: () => number; label: string; setValue: (v: number) => void }[] = [
            { getValue: () => this.audio.masterVolume, label: 'Master Volume', setValue: (v) => this.audio.setMasterVolume(v) },
            { getValue: () => this.audio.bgmVolume, label: 'BGM Volume', setValue: (v) => this.audio.setVolume('bgm', v) },
            { getValue: () => this.audio.sfxVolume, label: 'SFX Volume', setValue: (v) => this.audio.setVolume('sfx', v) },
            { getValue: () => this.audio.voiceVolume, label: 'Voice Volume', setValue: (v) => this.audio.setVolume('voice', v) },
        ];

        const sliderResults: SliderResult[] = [];

        for (const { getValue, label, setValue } of sliderDefs) {
            const result = createSlider(theme, cfg, display.width, {
                label,
                onChange: setValue,
                value: getValue(),
            });
            result.container.position.set(contentStartX, yPos);
            container.addChild(result.container);
            sliderResults.push(result);
            registerFocusableRow(yPos);
            yPos += spacing;
        }

        yPos += 10;
        const autoAdvanceToggle: ToggleResult = createToggle(theme, cfg, {
            label: 'Auto-Advance',
            onChange: (on) => this.dialogueHandler.setAutoAdvanceDelay(on ? 3000 : undefined),
            value: this.dialogueHandler.getAutoAdvanceDelay() !== undefined,
        });
        autoAdvanceToggle.container.position.set(contentStartX, yPos);
        container.addChild(autoAdvanceToggle.container);
        registerFocusableRow(yPos, autoAdvanceToggle.toggle);

        yPos += spacing;
        const reducedMotionToggle: ToggleResult = createToggle(theme, cfg, {
            label: 'Reduced Motion',
            onChange: (on) => this.dialogueHandler.setReducedMotion(on),
            value: this.dialogueHandler.getReducedMotion(),
        });
        reducedMotionToggle.container.position.set(contentStartX, yPos);
        container.addChild(reducedMotionToggle.container);
        registerFocusableRow(yPos, reducedMotionToggle.toggle);

        yPos += spacing;
        const captionsToggle: ToggleResult = createToggle(theme, cfg, {
            label: 'Captions',
            onChange: (on) => this.dialogueHandler.setCaptionsEnabled(on),
            value: this.dialogueHandler.getCaptionsEnabled(),
        });
        captionsToggle.container.position.set(contentStartX, yPos);
        container.addChild(captionsToggle.container);
        registerFocusableRow(yPos, captionsToggle.toggle);

        yPos += spacing;
        const selfVoicingToggle: ToggleResult = createToggle(theme, cfg, {
            label: 'Self-Voicing',
            onChange: (on) => this.dialogueHandler.setSelfVoicingEnabled(on),
            value: this.dialogueHandler.getSelfVoicingEnabled(),
        });
        selfVoicingToggle.container.position.set(contentStartX, yPos);
        container.addChild(selfVoicingToggle.container);
        registerFocusableRow(yPos, selfVoicingToggle.toggle);

        yPos += spacing;
        const fontSizeSlider = createSlider(theme, cfg, display.width, {
            label: 'Text Size',
            onChange: (v) => {
                theme.fontSize = sliderValueToTextSize(v);
                this.dialogueHandler.reset?.();
            },
            value: textSizeToSliderValue(theme.fontSize),
        });
        fontSizeSlider.container.position.set(contentStartX, yPos);
        container.addChild(fontSizeSlider.container);
        sliderResults.push(fontSizeSlider);
        registerFocusableRow(yPos);

        yPos += spacing;
        const typewriterDelaySlider = createSlider(theme, cfg, display.width, {
            label: 'Typewriter Delay',
            onChange: (v) => {
                this.dialogueHandler.setTypewriterSpeed(sliderValueToTypewriterSpeed(v));
            },
            value: typewriterSpeedToSliderValue(this.dialogueHandler.getTypewriterSpeed()),
        });
        typewriterDelaySlider.container.position.set(contentStartX, yPos);
        container.addChild(typewriterDelaySlider.container);
        sliderResults.push(typewriterDelaySlider);
        registerFocusableRow(yPos);

        const backMargin = 20;
        const backButton = createButton(theme, cfg, {
            label: 'Back',
            x: display.width / 2,
            y: display.height - cfg.buttonHeight - backMargin,
        }, onClose);
        container.addChild(backButton);

        registerFocusableButton(theme, cfg, focus, backButton, onClose);

        const sliderFocusMap = createSettingsSliderFocusMap();
        focus.onNavigateRaw = (direction: 'down' | 'left' | 'right' | 'up') => {
            const index = focus.selectedIndex;
            if (index in sliderFocusMap) {
                const sIndex = sliderFocusMap[index];
                const slider = sliderResults[sIndex];
                if (!slider) return false;
                if (direction === 'left') {
                    slider.applyValue(slider.getValue() - SLIDER_STEP);
                    return true;
                }
                if (direction === 'right') {
                    slider.applyValue(slider.getValue() + SLIDER_STEP);
                    return true;
                }
            }
            return false;
        };

        return { container };
    }
}

export function clampSettingsSliderValue(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value));
}

export function createSettingsSliderFocusMap(): Record<number, number> {
    return {
        0: 0,
        1: 1,
        2: 2,
        3: 3,
        8: 4,
        9: 5,
    };
}

export function sliderValueToTextSize(value: number): number {
    return Math.round(TEXT_SIZE_MIN + clampSettingsSliderValue(value) * (TEXT_SIZE_MAX - TEXT_SIZE_MIN));
}

export function sliderValueToTypewriterSpeed(value: number): number {
    return Math.round(clampSettingsSliderValue(value) * MAX_TYPEWRITER_SPEED_MS);
}

export function textSizeToSliderValue(fontSize: number): number {
    return clampSettingsSliderValue((fontSize - TEXT_SIZE_MIN) / (TEXT_SIZE_MAX - TEXT_SIZE_MIN));
}

export function typewriterSpeedToSliderValue(speedMs?: number): number {
    return clampSettingsSliderValue((speedMs ?? DEFAULT_TYPEWRITER_SPEED_MS) / MAX_TYPEWRITER_SPEED_MS);
}

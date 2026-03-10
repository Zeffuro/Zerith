import { Container, type FederatedPointerEvent, Graphics } from 'pixi.js';

import type { DialogueHandler } from '../handlers/DialogueHandler';
import type { IAudioManager } from '../interfaces/managers';
import type { MenuPanel, PanelBuildDeps } from '../types';
import type { SliderResult, ToggleResult } from './UIComponents';

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
        let yPos = 100;
        const spacing = 70;

        const createFocusIndicator = (atY: number): Graphics => {
            const indicator = new Graphics();
            indicator.roundRect(contentStartX - 15, atY, 4, 40, 2);
            indicator.fill({ alpha: 0.9, color: theme.accentColor });
            indicator.visible = false;
            container.addChild(indicator);
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
            const result = createSlider(theme, cfg, display.width, {
                label,
                onChange: setValue,
                value: getValue(),
            });
            result.container.position.set(contentStartX, yPos);
            container.addChild(result.container);
            sliderResults.push(result);

            focus.register({
                activate: () => {},
                blur: () => {},
                focus: () => {},
            });

            yPos += spacing;
        }

        yPos += 10;
        const toggleResult: ToggleResult = createToggle(theme, cfg, {
            label: 'Auto-Advance',
            onChange: (on) => this.dialogueHandler.setAutoAdvanceDelay(on ? 3000 : undefined),
            value: this.dialogueHandler.getAutoAdvanceDelay() !== undefined,
        });
        toggleResult.container.position.set(contentStartX, yPos);
        container.addChild(toggleResult.container);

        // ── Dialogue Font Size ──
        yPos += spacing;
        const fontSizeSlider = createSlider(theme, cfg, display.width, {
            label: 'Text Size',
            onChange: (v) => {
                theme.fontSize = Math.round(14 + v * 26);
                this.dialogueHandler.reset?.();
            },
            value: (theme.fontSize - 14) / 26,
        });
        fontSizeSlider.container.position.set(contentStartX, yPos);
        container.addChild(fontSizeSlider.container);
        sliderResults.push(fontSizeSlider);

        const fontSizeIndicator = createFocusIndicator(yPos);
        focus.register({
            activate: () => {},
            blur: () => { fontSizeIndicator.visible = false; },
            focus: () => { fontSizeIndicator.visible = true; },
        });

        const backMargin = 20;
        const backButton = createButton(theme, cfg, {
            label: 'Back',
            x: display.width / 2,
            y: display.height - cfg.buttonHeight - backMargin,
        }, onClose);
        container.addChild(backButton);

        registerFocusableButton(theme, cfg, focus, backButton, onClose);

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

        return { container };
    }
}
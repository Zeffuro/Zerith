import { Graphics } from "pixi.js";

import type { MenuPanel } from '../types';
import type { SliderResult, ToggleResult } from './UIComponents';
import type { UIRenderContext } from './UIRenderContext';

import { createButton, createPanelTitle, createSlider, createToggle, registerFocusableButton } from './UIComponents';

export class SettingsPanel implements MenuPanel {
    public id = 'settings';
    public label = 'Settings';

    build(renderContext: UIRenderContext, onClose: () => void) {
        const context = renderContext.uiContext;
        const cfg = context.overlayConfig;
        const focus = renderContext.focus;

        const root = renderContext.createPanelBase();
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
            { getValue: () => renderContext.audio.masterVolume, label: 'Master Volume', setValue: (v) => renderContext.audio.setMasterVolume(v) },
            { getValue: () => renderContext.audio.bgmVolume, label: 'BGM Volume', setValue: (v) => renderContext.audio.setVolume('bgm', v) },
            { getValue: () => renderContext.audio.sfxVolume, label: 'SFX Volume', setValue: (v) => renderContext.audio.setVolume('sfx', v) },
            { getValue: () => renderContext.audio.voiceVolume, label: 'Voice Volume', setValue: (v) => renderContext.audio.setVolume('voice', v) },
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
            onChange: (on) => renderContext.setAutoAdvance(on ? 3000 : undefined),
            value: renderContext.autoAdvanceDelay !== undefined,
        });
        toggleResult.container.position.set(contentStartX, yPos);
        root.addChild(toggleResult.container);

        // ── Dialogue Font Size ──
        yPos += spacing;
        const fontSizeSlider = createSlider(context, {
            label: 'Text Size',
            onChange: (v) => {
                const newSize = Math.round(14 + v * 26);
                renderContext.theme.fontSize = newSize;

                const dh = renderContext.getHandler('dialogue');
                dh?.reset?.();
            },
            value: (renderContext.theme.fontSize - 14) / 26,
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
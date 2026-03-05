import { Graphics } from "pixi.js";
import type { Engine } from '../Engine';
import type { MenuPanel } from '../types';
import { createPanelTitle, createSlider, createToggle, createButton, registerFocusableButton } from './UIComponents';
import type { SliderResult, ToggleResult } from './UIComponents';

export class SettingsPanel implements MenuPanel {
    public id = 'settings';
    public label = 'Settings';

    build(engine: Engine, onClose: () => void) {
        const overlay = engine.overlay;
        const ctx = overlay.getUIContext();
        const cfg = ctx.overlayConfig;
        const focus = overlay.focus;

        const root = overlay.createPanelBase();
        root.addChild(createPanelTitle(ctx, 'SETTINGS'));

        const contentStartX = (ctx.canvasWidth - 400 - 180 - 80) / 2;
        let yPos = 100;
        const spacing = 70;
        const cleanups: (() => void)[] = [];

        const createFocusIndicator = (atY: number): Graphics => {
            const indicator = new Graphics();
            indicator.roundRect(contentStartX - 15, atY, 4, 40, 2);
            indicator.fill({ color: ctx.theme.accentColor, alpha: 0.9 });
            indicator.visible = false;
            root.addChild(indicator);
            return indicator;
        };

        const sliderDefs: { label: string; getValue: () => number; setValue: (v: number) => void }[] = [
            { label: 'Master Volume', getValue: () => engine.audio.masterVolume, setValue: (v) => engine.audio.setMasterVolume(v) },
            { label: 'BGM Volume', getValue: () => engine.audio.bgmVolume, setValue: (v) => engine.audio.setVolume('bgm', v) },
            { label: 'SFX Volume', getValue: () => engine.audio.sfxVolume, setValue: (v) => engine.audio.setVolume('sfx', v) },
            { label: 'Voice Volume', getValue: () => engine.audio.voiceVolume, setValue: (v) => engine.audio.setVolume('voice', v) },
        ];

        const sliderResults: SliderResult[] = [];

        sliderDefs.forEach(({ label, getValue, setValue }) => {
            const result = createSlider(ctx, {
                label,
                value: getValue(),
                onChange: setValue,
            });
            result.container.position.set(contentStartX, yPos);
            root.addChild(result.container);
            cleanups.push(result.cleanup);
            sliderResults.push(result);

            focus.register({
                focus: () => {},
                blur: () => {},
                activate: () => {},
            });

            yPos += spacing;
        });

        yPos += 10;
        const toggleResult: ToggleResult = createToggle(ctx, {
            label: 'Auto-Advance',
            value: engine.autoAdvanceDelay !== null,
            onChange: (on) => engine.setAutoAdvance(on ? 3000 : null),
        });
        toggleResult.container.position.set(contentStartX, yPos);
        root.addChild(toggleResult.container);

        // ── Dialogue Font Size ──
        yPos += spacing;
        const fontSizeSlider = createSlider(ctx, {
            label: 'Text Size',
            value: (engine.theme.fontSize - 14) / 26,
            onChange: (v) => {
                const newSize = Math.round(14 + v * 26);
                engine.theme.fontSize = newSize;

                const dh = engine.getHandler('dialogue') as any;
                if (dh) { dh.container = null; }
            },
        });
        fontSizeSlider.container.position.set(contentStartX, yPos);
        root.addChild(fontSizeSlider.container);
        cleanups.push(fontSizeSlider.cleanup);
        sliderResults.push(fontSizeSlider);

        const fontSizeIndicator = createFocusIndicator(yPos);
        focus.register({
            focus: () => { fontSizeIndicator.visible = true; },
            blur: () => { fontSizeIndicator.visible = false; },
            activate: () => {},
        });

        const backMargin = 20;
        const backBtn = createButton(ctx, {
            label: 'Back',
            x: ctx.canvasWidth / 2,
            y: ctx.canvasHeight - cfg.buttonHeight - backMargin,
        }, onClose);
        root.addChild(backBtn);

        registerFocusableButton(ctx, focus, backBtn, onClose);

        const sliderStep = 0.05;
        focus.onNavigateRaw = (direction: 'up' | 'down' | 'left' | 'right') => {
            const idx = focus.selectedIndex;
            const sliderFocusMap: Record<number, number> = {
                0: 0, 1: 1, 2: 2, 3: 3,
                5: 4,
            };
            if (idx in sliderFocusMap) {
                const sIdx = sliderFocusMap[idx];
                if (direction === 'left') {
                    const s = sliderResults[sIdx];
                    s.applyValue(s.getValue() - sliderStep);
                    return true;
                }
                if (direction === 'right') {
                    const s = sliderResults[sIdx];
                    s.applyValue(s.getValue() + sliderStep);
                    return true;
                }
            }
            return false;
        };

        return {
            container: root,
            cleanup: () => cleanups.forEach(fn => fn()),
        };
    }
}
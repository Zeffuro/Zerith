import type { Engine } from '../Engine';
import type { MenuPanel } from '../types';
import type { Graphics } from 'pixi.js';
import { createPanelTitle, createSlider, createToggle, createButton } from './UIComponents';
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

        //const toggleFocusIndex = sliderResults.length;
        focus.register({
            focus: () => {},
            blur: () => {},
            activate: () => toggleResult.toggle(),
        });

        const backMargin = 20;
        const backBtn = createButton(ctx, {
            label: 'Back',
            x: ctx.canvasWidth / 2,
            y: ctx.canvasHeight - cfg.buttonHeight - backMargin,
        }, onClose);
        root.addChild(backBtn);

        const backBg = backBtn.children[0] as Graphics;
        const bw = cfg.buttonWidth;
        const bh = cfg.buttonHeight;
        focus.register({
            focus: () => {
                backBg.clear();
                backBg.roundRect(0, 0, bw, bh, 8);
                backBg.fill({ color: cfg.buttonHoverColor, alpha: 1 });
                backBg.stroke({ color: ctx.theme.accentColor, width: 2 });
            },
            blur: () => {
                backBg.clear();
                backBg.roundRect(0, 0, bw, bh, 8);
                backBg.fill({ color: cfg.buttonColor, alpha: cfg.buttonAlpha });
                backBg.stroke({ color: ctx.theme.borderColor, width: 2 });
            },
            activate: onClose,
        });

        const sliderStep = 0.05;
        focus.onNavigateRaw = (direction: 'up' | 'down' | 'left' | 'right') => {
            const idx = focus.selectedIndex;
            if (idx < sliderResults.length) {
                if (direction === 'left') {
                    const s = sliderResults[idx];
                    s.applyValue(s.getValue() - sliderStep);
                    return true;
                }
                if (direction === 'right') {
                    const s = sliderResults[idx];
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
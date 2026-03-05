import type { Engine } from '../Engine';
import type { MenuPanel } from '../types';
import { createPanelTitle, createSlider, createToggle, createButton } from './UIComponents';

export class SettingsPanel implements MenuPanel {
    public id = 'settings';
    public label = 'Settings';

    build(engine: Engine, onClose: () => void) {
        const overlay = engine.overlay;
        const ctx = overlay.getUIContext();

        const root = overlay.createPanelBase();
        root.addChild(createPanelTitle(ctx, 'SETTINGS'));

        const contentStartX = (ctx.canvasWidth - 400 - 180 - 80) / 2;
        let yPos = 100;
        const spacing = 70;
        const cleanups: (() => void)[] = [];

        const sliders: { label: string; getValue: () => number; setValue: (v: number) => void }[] = [
            { label: 'Master Volume', getValue: () => engine.audio.masterVolume, setValue: (v) => engine.audio.setMasterVolume(v) },
            { label: 'BGM Volume', getValue: () => engine.audio.bgmVolume, setValue: (v) => engine.audio.setVolume('bgm', v) },
            { label: 'SFX Volume', getValue: () => engine.audio.sfxVolume, setValue: (v) => engine.audio.setVolume('sfx', v) },
            { label: 'Voice Volume', getValue: () => engine.audio.voiceVolume, setValue: (v) => engine.audio.setVolume('voice', v) },
        ];

        sliders.forEach(({ label, getValue, setValue }) => {
            const { container, cleanup } = createSlider(ctx, {
                label,
                value: getValue(),
                onChange: setValue,
            });
            container.position.set(contentStartX, yPos);
            root.addChild(container);
            cleanups.push(cleanup);
            yPos += spacing;
        });

        yPos += 10;
        const toggle = createToggle(ctx, {
            label: 'Auto-Advance',
            value: engine.autoAdvanceDelay !== null,
            onChange: (on) => engine.setAutoAdvance(on ? 3000 : null),
        });
        toggle.position.set(contentStartX, yPos);
        root.addChild(toggle);

        const backBtn = createButton(ctx, { label: 'Back', x: ctx.canvasWidth / 2, y: ctx.canvasHeight - 50 }, onClose);
        root.addChild(backBtn);

        return {
            container: root,
            cleanup: () => cleanups.forEach(fn => fn()),
        };
    }
}
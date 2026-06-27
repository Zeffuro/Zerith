import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_TYPEWRITER_SPEED_MS } from '../../handlers/DialogueHandler';
import { PanelFocusManager } from '../PanelFocusManager';
import {
    clampSettingsSliderValue,
    createSettingsSliderFocusMap,
    SettingsPanel,
    sliderValueToTextSize,
    sliderValueToTypewriterSpeed,
    textSizeToSliderValue,
    typewriterSpeedToSliderValue,
} from '../SettingsPanel';

describe('SettingsPanel helpers', () => {
    it('clamps slider values before applying runtime settings', () => {
        expect(clampSettingsSliderValue(-0.5)).toBe(0);
        expect(clampSettingsSliderValue(0.5)).toBe(0.5);
        expect(clampSettingsSliderValue(1.5)).toBe(1);
        expect(clampSettingsSliderValue(Number.NaN)).toBe(0);
    });

    it('maps text size to and from the settings slider', () => {
        expect(textSizeToSliderValue(14)).toBe(0);
        expect(textSizeToSliderValue(40)).toBe(1);
        expect(sliderValueToTextSize(0.5)).toBe(27);
    });

    it('maps typewriter delay to and from the settings slider', () => {
        expect(typewriterSpeedToSliderValue()).toBe(0.25);
        expect(typewriterSpeedToSliderValue(120)).toBe(1);
        expect(typewriterSpeedToSliderValue(240)).toBe(1);
        expect(sliderValueToTypewriterSpeed(0.25)).toBe(30);
        expect(sliderValueToTypewriterSpeed(2)).toBe(120);
    });

    it('keeps keyboard focus indices aligned with slider rows', () => {
        expect(createSettingsSliderFocusMap()).toEqual({
            0: 0,
            1: 1,
            2: 2,
            3: 3,
            8: 4,
            9: 5,
        });
    });

    it('wires captions and self-voicing toggles into focusable settings rows', () => {
        const setCaptionsEnabled = vi.fn();
        const setSelfVoicingEnabled = vi.fn();
        const panel = new SettingsPanel(
            {
                bgmVolume: 0.8,
                masterVolume: 1,
                setMasterVolume: vi.fn(),
                setVolume: vi.fn(),
                sfxVolume: 0.9,
                voiceVolume: 0.7,
            } as unknown as ConstructorParameters<typeof SettingsPanel>[0],
            {
                getAutoAdvanceDelay: vi.fn(),
                getCaptionsEnabled: () => false,
                getReducedMotion: () => false,
                getSelfVoicingEnabled: () => false,
                getTypewriterSpeed: () => DEFAULT_TYPEWRITER_SPEED_MS,
                reset: vi.fn(),
                setAutoAdvanceDelay: vi.fn(),
                setCaptionsEnabled,
                setReducedMotion: vi.fn(),
                setSelfVoicingEnabled,
                setTypewriterSpeed: vi.fn(),
            } as unknown as ConstructorParameters<typeof SettingsPanel>[1],
        );
        const focus = new PanelFocusManager();

        panel.build({
            display: { height: 720, width: 1280 },
            focus,
            onClose: vi.fn(),
            overlayConfig: {
                backgroundAlpha: 0.95,
                backgroundColor: 0x00_00_00,
                buttonAlpha: 0.8,
                buttonColor: 0x22_22_22,
                buttonHeight: 50,
                buttonHoverColor: 0x44_44_44,
                buttonSpacing: 12,
                buttonWidth: 200,
                fontFamily: 'Arial',
                fontSize: 20,
                textColor: 0xFF_FF_FF,
                uiScale: 1,
            },
            theme: {
                accentColor: 0xFF_AA_AA,
                borderColor: 0xAA_AA_FF,
                borderWidth: 4,
                boxAlpha: 0.9,
                boxColor: 0x00_00_55,
                fontFamily: 'Courier New',
                fontSize: 24,
                hoverColor: 0x33_33_99,
            },
        });

        expect(focus.count).toBe(11);

        focus.focusInitial(0);
        for (let index = 0; index < 6; index += 1) {
            focus.navigate('down');
        }
        focus.confirm();
        focus.navigate('down');
        focus.confirm();

        expect(setCaptionsEnabled).toHaveBeenCalledWith(true);
        expect(setSelfVoicingEnabled).toHaveBeenCalledWith(true);
    });
});

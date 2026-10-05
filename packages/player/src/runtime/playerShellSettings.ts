import type { PlayerDisplayControls } from './desktopDisplayControls';
import type { PlayerPreferences } from './playerPreferences';

import { button, element } from './playerShellDom';

export function buildPlayerSettings(
    root: HTMLElement,
    preferences: PlayerPreferences,
    change: (next: PlayerPreferences) => void,
    reset: () => void,
    display: PlayerDisplayControls,
): () => void {
    const groups = element('div', 'zerith-shell-settings');
    const audio = group(groups, 'Audio');
    range(audio, 'Master volume', 'masterVolume', preferences, 0, 1, 0.05, change, true);
    range(audio, 'Music', 'bgmVolume', preferences, 0, 1, 0.05, change, true);
    range(audio, 'Sound effects', 'sfxVolume', preferences, 0, 1, 0.05, change, true);
    range(audio, 'Voice', 'voiceVolume', preferences, 0, 1, 0.05, change, true);
    toggle(audio, 'Mute audio', 'muted', preferences, change);
    const text = group(groups, 'Text');
    range(text, 'Text size', 'textSize', preferences, 14, 40, 1, change);
    range(text, 'Text delay', 'typewriterDelay', preferences, 0, 120, 5, change, false, ' ms');
    toggle(text, 'Auto-Advance', 'autoAdvance', preferences, change);
    text.append(element('p', 'zerith-shell-note', 'Auto-Advance waits briefly after each line. Set text delay to 0 for instant text.'));
    const accessibility = group(groups, 'Accessibility');
    toggle(accessibility, 'Dialogue announcements', 'captions', preferences, change);
    toggle(accessibility, 'Self-voicing', 'selfVoicing', preferences, change);
    toggle(accessibility, 'Reduced motion', 'reducedMotion', preferences, change);
    accessibility.append(element('p', 'zerith-shell-note', 'Dialogue announcements send the speaker and text to your screen reader.'));
    const modes = group(groups, 'Display');
    const fullscreen = button('Fullscreen', () => { void display.setFullscreen(true); });
    const windowed = button('Windowed', () => { void display.setFullscreen(false); });
    const status = element('p', 'zerith-shell-note');
    status.setAttribute('role', 'status');
    modes.append(fullscreen, windowed, status, element('p', 'zerith-shell-note', 'F11 or Alt+Enter switches display mode.'));
    const update = () => {
        const state = display.getState();
        fullscreen.disabled = state.pending || !state.available;
        windowed.disabled = state.pending || !state.available;
        fullscreen.setAttribute('aria-pressed', String(state.fullscreen));
        windowed.setAttribute('aria-pressed', String(!state.fullscreen));
        status.textContent = state.status || (state.available ? (state.fullscreen ? 'Fullscreen' : 'Windowed') : 'Fullscreen is unavailable in this browser.');
    };
    update();
    const unsubscribe = display.subscribe(update);
    root.append(groups, button('Reset settings', reset));
    return unsubscribe;
}

function group(root: HTMLElement, title: string): HTMLElement {
    const section = element('section', 'zerith-shell-setting-group');
    section.append(element('h3', undefined, title));
    root.append(section);
    return section;
}

function range(
    root: HTMLElement, label: string,
    key: 'bgmVolume' | 'masterVolume' | 'sfxVolume' | 'textSize' | 'typewriterDelay' | 'voiceVolume',
    preferences: PlayerPreferences, min: number, max: number, step: number,
    change: (next: PlayerPreferences) => void, percentage = false, suffix = '',
): void {
    const row = element('label', 'zerith-shell-setting');
    const input = element('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(preferences[key]);
    input.setAttribute('aria-label', label);
    const output = element('output');
    const format = () => { output.textContent = percentage ? `${Math.round(Number(input.value) * 100)}%` : `${input.value}${suffix}`; };
    format();
    input.addEventListener('input', () => {
        preferences[key] = Number(input.value);
        format();
        change({ ...preferences });
    });
    row.append(element('span', undefined, label), output, input);
    root.append(row);
}

function toggle(
    root: HTMLElement, label: string,
    key: 'autoAdvance' | 'captions' | 'muted' | 'reducedMotion' | 'selfVoicing',
    preferences: PlayerPreferences, change: (next: PlayerPreferences) => void,
): void {
    const row = element('label', 'zerith-shell-setting zerith-shell-toggle');
    const input = element('input');
    input.type = 'checkbox';
    input.checked = preferences[key];
    input.addEventListener('change', () => { preferences[key] = input.checked; change({ ...preferences }); });
    row.append(element('span', undefined, label), input);
    root.append(row);
}


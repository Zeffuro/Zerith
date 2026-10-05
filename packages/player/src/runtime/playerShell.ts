import type { DialogueHandler, Engine } from '@zeffuro/zerith-core';

import type { PlayerDisplayControls } from './desktopDisplayControls';
import type { PlayerPreferences } from './playerPreferences';
import type { PlayerPauseAction, PlayerShellConfig, PlayerTitleAction } from './playerShellConfig';

import { applyPlayerPreferences, resetPlayerPreferences, writePlayerPreferences } from './playerPreferences';
import { applyPlayerShellAppearance } from './playerShellAppearance';
import { button, element, focusable } from './playerShellDom';
import { installPlayerShellInput } from './playerShellInput';
import { buildPlayerSettings } from './playerShellSettings';
import './playerShell.css';

export interface PlayerShell {
    dispose(): void;
    start(): Promise<void>;
}

export interface PlayerShellContext {
    baseUrl: string;
    canvas: HTMLCanvasElement;
    config: PlayerShellConfig;
    defaults: PlayerPreferences;
    display: PlayerDisplayControls;
    engine: Engine;
    preferences: PlayerPreferences;
    startScene: string;
    warning?: string;
}

type Action = PlayerPauseAction | PlayerTitleAction;
type View = 'confirm' | 'history' | 'load' | 'pause' | 'save' | 'settings' | 'title';
const LABELS: Record<Action, string> = {
    continue: 'Continue', history: 'History', load: 'Load', 'new-game': 'New Game',
    resume: 'Resume', save: 'Save', settings: 'Settings', title: 'Return to title',
};

export function createDefaultPlayerShell(context: PlayerShellContext): PlayerShell {
    const { baseUrl, canvas, config, defaults, display, engine, startScene } = context;
    const root = element('div', 'zerith-player-shell');
    const panel = element('section', 'zerith-shell-panel');
    const header = element('header', 'zerith-shell-header');
    const heading = element('h1');
    heading.id = 'zerith-shell-heading';
    const content = element('div', 'zerith-shell-content');
    const status = element('p', 'zerith-shell-status');
    status.setAttribute('role', 'status');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', heading.id);
    header.append(heading);
    panel.append(header, content, status);
    root.append(panel);
    applyPlayerShellAppearance(root, config);
    if (config.background) {
        const background = element('img', 'zerith-shell-background');
        background.src = new URL(config.background, baseUrl).toString();
        background.alt = '';
        root.prepend(background);
    }
    root.hidden = true;
    (canvas.parentElement ?? document.body).append(root);
    document.title = config.title;
    let view: View = 'title';
    let origin: 'pause' | 'title' = 'title';
    let preferences = { ...context.preferences };
    let warning = context.warning ?? '';
    let releaseSuspension: (() => void) | undefined;
    let disposeView: (() => void) | undefined;
    let busy = false;
    let disposed = false;
    let confirmation: { accept: () => void; cancel: () => void; message: string } | undefined;
    let resolveStart: (() => void) | undefined;
    const started = new Promise<void>(resolve => { resolveStart = resolve; });
    const dialogue = engine.getHandler('dialogue') as DialogueHandler | undefined;
    const apply = () => {
        applyPlayerPreferences(engine, preferences, dialogue);
        if (!preferences.selfVoicing) globalThis.speechSynthesis?.cancel();
    };
    apply();

    const close = () => {
        if (disposed) return;
        disposeView?.();
        disposeView = undefined;
        root.hidden = true;
        canvas.inert = false;
        engine.overlay.close();
        releaseSuspension?.();
        releaseSuspension = undefined;
        engine.setInputEnabled(true);
        canvas.focus();
    };
    const show = (next: View) => {
        if (disposed) return;
        if (root.hidden) {
            releaseSuspension = engine.flow.acquireSuspension?.();
            engine.setInputEnabled(false);
            engine.overlay.close();
            globalThis.speechSynthesis?.cancel();
            canvas.inert = true;
            root.hidden = false;
        }
        view = next;
        render();
    };
    const goBack = () => {
        if (busy) return;
        if (view === 'confirm') confirmation?.cancel();
        else if (view === 'pause') close();
        else if (view !== 'title') show(origin);
    };
    const openPause = () => {
        if (!engine.isStarted || !root.hidden) return;
        origin = 'pause';
        show('pause');
    };
    const confirm = (message: string, accept: () => void) => {
        const previous = view;
        confirmation = { accept, cancel: () => show(previous), message };
        show('confirm');
    };
    const run = async (action: () => Promise<void> | void) => {
        if (busy || disposed) return;
        busy = true;
        status.textContent = '';
        const buttons = [...root.querySelectorAll<HTMLButtonElement>('button')];
        const previousDisabled = buttons.map(node => node.disabled);
        for (const node of buttons) node.disabled = true;
        panel.setAttribute('aria-busy', 'true');
        try { await action(); }
        catch (error) { warning = error instanceof Error ? error.message : 'The game could not complete that action.'; }
        finally {
            busy = false;
            panel.removeAttribute('aria-busy');
            if (!disposed && !root.hidden) {
                for (const [index, node] of buttons.entries()) { node.disabled = previousDisabled[index]; }
                status.textContent = warning;
                if (!root.contains(document.activeElement)) focusable(root)[0]?.focus();
            }
        }
    };
    const begin = async () => {
        engine.stop();
        engine.clear();
        await engine.scenes.jumpToScene(startScene);
        if (disposed) return;
        close();
        engine.start();
        resolveStart?.();
    };
    const load = async (slot: number) => {
        const saved = await engine.saves.load(slot);
        if (!saved) throw new Error('This save could not be read.');
        if (!engine.scenes.hasScene(saved.sceneName)) throw new Error('The scene in this save is unavailable.');
        await engine.applySaveState(saved);
        if (disposed) return;
        close();
        engine.start();
        resolveStart?.();
    };
    const latestSave = () => engine.saves.listSlots(config.saveSlots)
        .filter(meta => meta !== undefined)
        .filter(meta => engine.scenes.hasScene(meta.sceneName))
        .toSorted((a, b) => b.savedAt - a.savedAt)[0];
    const perform = (action: Action) => {
        warning = '';
        switch (action) {
        case 'continue': {
            const latest = latestSave();
            if (latest) void run(() => load(latest.slot));
        
        break;
        }
        case 'new-game': {
        void run(begin);
        break;
        }
        case 'resume': {
        close();
        break;
        }
        case 'title': {
            confirm('Return to the title menu? Progress since your last save will be lost.', () => {
                engine.stop();
                engine.clear();
                origin = 'title';
                show('title');
            });
        
        break;
        }
        default: { show(action);
        }
        }
    };
    const render = () => {
        disposeView?.();
        disposeView = undefined;
        content.replaceChildren();
        header.replaceChildren(heading);
        root.dataset.view = view;
        root.dataset.origin = origin;
        status.textContent = warning;
        if (view === 'title' || view === 'pause') {
            heading.textContent = view === 'title' ? config.title : 'Paused';
            if (view === 'title' && config.subtitle) content.append(element('p', 'zerith-shell-subtitle', config.subtitle));
            const actions = view === 'title' ? config.titleActions : config.pauseActions;
            const menu = element('nav', 'zerith-shell-menu');
            menu.setAttribute('aria-label', view === 'title' ? 'Title menu' : 'Pause menu');
            for (const action of actions) {
                const control = button(config.actionLabels?.[action] ?? LABELS[action], () => perform(action));
                if (action === 'continue') control.disabled = !latestSave();
                menu.append(control);
            }
            content.append(menu);
            if (view === 'title') content.append(element('p', 'zerith-shell-note', `Press ${engine.config.input?.menuKey ?? 'Escape'}, right-click, or touch and hold to open the game menu.`));
        } else {
            const titles = { confirm: 'Confirm', history: 'History', load: 'Load game', save: 'Save game', settings: 'Settings' };
            heading.textContent = titles[view];
            if (view !== 'confirm') header.append(button('Back', goBack));
            if (view === 'settings') {
                disposeView = buildPlayerSettings(content, preferences, next => {
                    preferences = next;
                    apply();
                    const result = writePlayerPreferences(config.rememberSettings ? engine.config.storage : undefined, preferences);
                    warning = result.warning ?? '';
                    status.textContent = warning;
                }, () => {
                    const result = resetPlayerPreferences(config.rememberSettings ? engine.config.storage : undefined, defaults);
                    preferences = result.preferences;
                    warning = result.warning ?? '';
                    apply();
                    render();
                }, display);
            } else if (view === 'confirm' && confirmation) {
                content.append(element('p', 'zerith-shell-confirmation', confirmation.message),
                    button('Cancel', confirmation.cancel), button('Confirm', confirmation.accept));
            } else if (view === 'history') {
                const entries = engine.history.getAll();
                if (entries.length === 0) content.append(element('p', 'zerith-shell-note', 'No dialogue yet.'));
                for (const entry of entries) {
                    const line = element('article', 'zerith-shell-history');
                    line.append(element('h3', undefined, entry.speaker), element('p', undefined, entry.text));
                    content.append(line);
                }
            } else buildSlots();
        }
        focusable(root)[0]?.focus();
    };
    const buildSlots = () => {
        const slots = element('div', 'zerith-shell-slots');
        for (let slot = 1; slot <= config.saveSlots; slot++) {
            const meta = engine.saves.getMeta(slot);
            const row = button(`Slot ${slot}`, () => {
                warning = '';
                if (view === 'save') {
                    const save = () => { void run(() => {
                        engine.saves.save(slot);
                        warning = `Saved to slot ${slot}.`;
                        show('save');
                    }); };
                    if (engine.saves.hasSlot(slot)) confirm(`Replace the save in slot ${slot}?`, save);
                    else save();
                } else {
                    const accept = () => { void run(() => load(slot)); };
                    if (origin === 'pause') confirm('Load this save? Progress since your last save will be lost.', accept);
                    else accept();
                }
            });
            row.classList.add('zerith-shell-slot');
            row.disabled = view === 'load' && (!meta || !engine.scenes.hasScene(meta.sceneName));
            if (meta) {
                row.append(element('span', 'zerith-shell-save-date', new Date(meta.savedAt).toLocaleString()),
                    element('span', 'zerith-shell-save-preview', meta.previewText || meta.sceneName));
            } else row.append(element('span', 'zerith-shell-save-preview', engine.saves.hasSlot(slot) ? 'Unreadable save' : 'Empty'));
            slots.append(row);
        }
        content.append(slots);
    };
    const onMenuToggle = () => { engine.overlay.close(); if (root.hidden) openPause(); else goBack(); };
    engine.events.on('menu:toggle', onMenuToggle);
    const disposeInput = installPlayerShellInput({
        back: goBack, canvas, input: engine.config.input, isOpen: () => !root.hidden,
        load: () => { if (config.pauseActions.includes('load')) { openPause(); show('load'); } },
        next: () => { if (engine.isStarted) { engine.events.emit('input:skip'); engine.events.emit('input:next'); } }, open: openPause,
        root,
        save: () => { if (config.pauseActions.includes('save')) { openPause(); show('save'); } },
    });
    return {
        dispose: () => {
            disposed = true;
            disposeView?.();
            disposeInput();
            engine.events.off('menu:toggle', onMenuToggle);
            releaseSuspension?.();
            canvas.inert = false;
            root.remove();
            resolveStart?.();
        },
        start: () => { origin = 'title'; show('title'); return started; },
    };
}


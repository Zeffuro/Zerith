import { useEffect, useRef, useState } from 'react';

import type { PlaytestDraft, PlaytestDraftLease } from '../../services/playtests/playtestDraft';
import type { PlaytestScenario } from '../../services/playtests/playtestModel';

import { usePlaytestDraft } from '../../hooks/usePlaytestDraft';
import { usePlaytestLibrary } from '../../hooks/usePlaytestLibrary';
import { openProjectEntry } from '../../services/openProjectEntry';
import { checkPlaytestResult, parsePlaytestScenario, parsePlaytestState } from '../../services/playtests/playtestModel';
import { validatePlaytestTarget } from '../../services/playtests/playtestRuntime';
import { useProjectStore, useScriptStore } from '../../store/storeBootstrap';
import { useEditorStore } from '../../store/useEditorStore';
import { useEngineBridgeStore } from '../../store/useEngineBridgeStore';
import { usePlaytestStore } from '../../store/usePlaytestStore';
import { editorTheme as t } from '../../theme/editorTheme';
import './PlaytestPanel.css';

export function PlaytestPanel() {
    const { activeFile, items, locales, projectGeneration, projectPath, scenePaths, scenes } = useProjectStore();
    const engine = useEngineBridgeStore(state => state.engine);
    const playback = usePlaytestStore();
    const library = usePlaytestLibrary(projectPath);
    const drafts = usePlaytestDraft(projectPath, projectGeneration);
    const { draft } = drafts;
    const libraryMessageLease = useRef<PlaytestDraftLease | undefined>(undefined);
    const [message, setMessage] = useState('');
    const [launching, setLaunching] = useState(false);
    const [replay, setReplay] = useState(false);
    const sceneNames = Object.keys(scenes).toSorted();
    const update = <K extends keyof PlaytestDraft>(key: K, value: PlaytestDraft[K]) => { drafts.edit({ [key]: value }); setMessage(''); };

    useEffect(() => {
        libraryMessageLease.current = undefined;
        setMessage('');
        setLaunching(false);
        usePlaytestStore.getState().reset();
    }, [projectGeneration, projectPath]);

    const scenario = (): PlaytestScenario => parsePlaytestScenario({
        choices: JSON.parse(draft.choices) as unknown,
        expectedScene: draft.expectedScene || undefined,
        expectedState: parsePlaytestState(JSON.parse(draft.expectedState)),
        id: draft.id || crypto.randomUUID(),
        index: draft.index - 1,
        inventory: draft.inventory,
        locale: draft.locale || undefined,
        name: draft.name.trim(),
        scene: draft.scene || sceneNames[0],
        state: parsePlaytestState(JSON.parse(draft.state)),
    });

    const load = (value: PlaytestScenario) => {
        drafts.select(value);
        setMessage('');
    };

    const attempt = (action: () => Promise<void> | void) => {
        const lease = drafts.capture();
        void Promise.resolve().then(() => { if (drafts.owns(lease)) return action(); }).catch((error: unknown) => { if (drafts.owns(lease)) setMessage(error instanceof Error ? error.message : String(error)); });
    };

    const save = async () => {
        const value = scenario();
        const lease = drafts.capture();
        libraryMessageLease.current = lease;
        const next = [...library.scenarios.filter(candidate => candidate.id !== value.id), value];
        if (await library.save(next)) drafts.completeSave(lease, value);
    };

    const remove = async () => {
        const lease = drafts.capture();
        libraryMessageLease.current = lease;
        if (await library.save(library.scenarios.filter(value => value.id !== draft.id))) drafts.completeDelete(lease);
    };

    const launch = async () => {
        if (!projectPath || launching) return;
        const lease = drafts.capture();
        const value = scenario();
        validatePlaytestTarget(value, scenes, Object.keys(items), Object.keys(locales));
        const path = scenePaths[value.scene];
        if (!path) throw new Error('This scene has no source file.');
        setLaunching(true);
        try {
            useEditorStore.getState().triggerStop();
            usePlaytestStore.getState().reset();
            await openProjectEntry(path, path.split(/[\\/]/u).at(-1) ?? path);
            if (!drafts.isActive(lease)) return;
            const current = useProjectStore.getState();
            if (current.projectPath !== projectPath || current.activeFile !== path) throw new Error('The requested scene could not be opened.');
            useEditorStore.getState().setPreviewLocale(value.locale);
            usePlaytestStore.getState().launch(projectPath, value, replay, projectGeneration);
            focusPreview();
        } finally { if (drafts.isActive(lease)) setLaunching(false); }
    };

    const capture = () => {
        if (!engine) return;
        const scene = Object.keys(scenePaths).find(name => scenePaths[name] === activeFile);
        drafts.edit({ index: (useScriptStore.getState().selectedNodePath?.[0] as number | undefined ?? 0) + 1, inventory: engine.items.serialize(), locale: useEditorStore.getState().previewLocale ?? '', scene: scene ?? draft.scene, state: JSON.stringify(engine.stateManager.state, undefined, 2) });
        setMessage('Captured variables and inventory from the preview.');
    };

    const check = () => {
        if (!engine || playback.request?.projectPath !== projectPath) throw new Error('Launch a playtest first.');
        const failures = checkPlaytestResult(scenario(), engine.currentSceneName, engine.stateManager.state);
        setMessage(failures.length > 0 ? failures.join(' ') : 'Expected scene and variables match the current preview.');
    };

    if (!projectPath) return <div style={{ padding: 12 }}>Open a project to create playtests.</div>;
    const disabled = library.busy || launching || !library.ready;
    return <div className="zerith-playtests" style={{ color: t.text.primary, display: 'flex', flexDirection: 'column', gap: 10, height: '100%', minWidth: 0, overflow: 'auto', padding: 12 }}>
        <strong>Playtests</strong>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button className="toolbar-btn" disabled={disabled} onClick={() => { drafts.clear(); setMessage(''); }}>New playtest</button>
            {library.scenarios.map(value => <button className="toolbar-btn" key={value.id} onClick={() => load(value)}>{value.name}</button>)}
        </div>
        <label>Name<input aria-label="Playtest name" onChange={event => update('name', event.target.value)} placeholder="Evening shift" value={draft.name} /></label>
        <label>Starting scene<select aria-label="Starting scene" onChange={event => update('scene', event.target.value)} value={draft.scene || sceneNames[0] || ''}>{sceneNames.map(name => <option key={name}>{name}</option>)}</select></label>
        <label>Starting command<input aria-label="Starting command" min={1} onChange={event => update('index', Number(event.target.value))} type="number" value={draft.index} /></label>
        <label>Locale<select aria-label="Playtest locale" onChange={event => update('locale', event.target.value)} value={draft.locale}><option value="">Source text</option>{Object.keys(locales).toSorted().map(locale => <option key={locale}>{locale}</option>)}</select></label>
        <label>Variables (JSON)<textarea aria-label="Playtest variables" onChange={event => update('state', event.target.value)} rows={5} value={draft.state} /></label>
        <fieldset><legend>Starting inventory</legend>{Object.keys(items).toSorted().map(id => <label key={id}><input checked={draft.inventory.includes(id)} onChange={event => update('inventory', event.target.checked ? [...draft.inventory, id] : draft.inventory.filter(item => item !== id))} type="checkbox" />{id}</label>)}</fieldset>
        <details><summary>Route recording and result checks</summary>
            <p>Choice numbers start at zero. Record a route while playing, then save it for replay. Result checks use the current preview state.</p>
            <label>Recorded choices<textarea aria-label="Recorded choices" onChange={event => update('choices', event.target.value)} value={draft.choices} /></label>
            <button className="toolbar-btn" disabled={playback.choices.length === 0} onClick={() => update('choices', JSON.stringify(playback.choices))}>Use recorded choices</button>
            <label>Expected scene<select aria-label="Expected scene" onChange={event => update('expectedScene', event.target.value)} value={draft.expectedScene}><option value="">No scene check</option>{sceneNames.map(name => <option key={name}>{name}</option>)}</select></label>
            <label>Expected variables (JSON)<textarea aria-label="Expected variables" onChange={event => update('expectedState', event.target.value)} value={draft.expectedState} /></label>
            <label><input checked={replay} onChange={event => setReplay(event.target.checked)} type="checkbox" />Replay recorded choices</label>
        </details>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button className="toolbar-btn" disabled={disabled} onClick={() => attempt(save)}>Save playtest</button>
            <button className="toolbar-btn" disabled={disabled} onClick={() => attempt(launch)}>Launch playtest</button>
            <button className="toolbar-btn" disabled={!engine} onClick={capture}>Capture preview state</button>
            <button className="toolbar-btn" disabled={!engine || !playback.request} onClick={() => attempt(check)}>Check results</button>
            <button className="toolbar-btn" disabled={disabled || !draft.id} onClick={() => attempt(remove)}>Delete playtest</button>
        </div>
        <div aria-live="polite" role="status">{message || ((!libraryMessageLease.current || drafts.owns(libraryMessageLease.current)) ? library.message : '') || playback.message}</div>
        {playback.visited.length > 0 && <div>Visited scenes: {playback.visited.join(', ')}</div>}
    </div>;
}

function focusPreview(): void {
    globalThis.dispatchEvent(new CustomEvent('zerith:dock-select', { detail: 'preview' }));
}

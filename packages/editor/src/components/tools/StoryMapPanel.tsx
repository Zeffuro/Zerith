import { useMemo, useState } from 'react';

import type { StoryMapNode } from '../../services/storyMap/storyMapModel';

import { filterStoryMap, layoutStoryMap } from '../../services/storyMap/storyMapModel';
import { openStoryMapSource } from '../../services/storyMap/storyMapNavigation';
import { storyMapFromProject, storyMapVisited, storyMapVisitedEdges } from '../../services/storyMap/storyMapProject';
import { useProjectStore } from '../../store/storeBootstrap';
import { usePlaytestStore } from '../../store/usePlaytestStore';
import { useWorkbenchStore } from '../../store/useWorkbenchStore';
import { editorTheme as t } from '../../theme/editorTheme';
import { StoryMapCanvas } from './storyMap/StoryMapCanvas';
import { useStoryMapPreferences } from './storyMap/useStoryMapPreferences';

export function StoryMapPanel() {
    const fieldStyle = { background: t.bg.input, border: `1px solid ${t.border.subtle}`, borderRadius: 4, color: t.text.normal, minHeight: 28, padding: '4px 6px' };
    const project = useProjectStore();
    const tabs = useWorkbenchStore(state => state.tabs);
    const playback = usePlaytestStore();
    const { preferences, update, warning } = useStoryMapPreferences(project.projectPath);
    const [selectedId, setSelectedId] = useState<string>();
    const [message, setMessage] = useState('');
    const map = useMemo(() => storyMapFromProject(project, tabs), [project, tabs]);
    const filtered = useMemo(() => filterStoryMap(map, preferences.filter, preferences.query, preferences.showMacros), [map, preferences.filter, preferences.query, preferences.showMacros]);
    const layout = useMemo(() => layoutStoryMap(map), [map]);
    const positions = useMemo(() => ({ ...layout, ...preferences.positions }), [layout, preferences.positions]);
    const visited = storyMapVisited(project.projectPath, playback.visited, playback.request);
    const visitedEdges = storyMapVisitedEdges(map, project.projectPath, playback.visited, playback.request);
    const selected = filtered.nodes.find(node => node.id === selectedId);
    const links = selected ? filtered.edges.filter(edge => edge.from === selected.id || edge.to === selected.id) : [];
    const open = (node: StoryMapNode) => {
        if (!node.source) { setMessage('This target has no source file. Open its incoming link to fix the reference.'); return; }
        void openStoryMapSource(node.source).catch(error => setMessage(error instanceof Error ? error.message : String(error)));
    };
    if (!project.projectPath) return <div style={{ color: t.text.muted, padding: 16 }}>Open a project to explore its story map.</div>;
    return <section aria-label="Story map" style={{ color: t.text.normal, display: 'flex', flexDirection: 'column', fontSize: 12, height: '100%', minHeight: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 8 }}>
            <input aria-label="Find story node" onChange={event => update({ ...preferences, query: event.target.value })} placeholder="Find a scene or choice" style={{ ...fieldStyle, minWidth: 100, width: 150 }} value={preferences.query} />
            <select aria-label="Story map filter" onChange={event => update({ ...preferences, filter: event.target.value as typeof preferences.filter })} style={fieldStyle} value={preferences.filter}>
                <option value="all">All routes</option><option value="missing">Missing targets</option><option value="unreachable">Unreachable nodes</option>
            </select>
            <label><input checked={preferences.showMacros} onChange={event => update({ ...preferences, showMacros: event.target.checked })} type="checkbox" />Macros</label>
            <button className="toolbar-btn" onClick={() => update({ ...preferences, zoom: Math.max(.2, preferences.zoom - .1) })} type="button">Zoom out</button>
            <span aria-label="Story map zoom">{Math.round(preferences.zoom * 100)}%</span>
            <button className="toolbar-btn" onClick={() => update({ ...preferences, zoom: Math.min(2, preferences.zoom + .1) })} type="button">Zoom in</button>
            <button className="toolbar-btn" onClick={() => update({ ...preferences, pan: { x: 0, y: 0 }, positions: {}, zoom: 1 })} type="button">Reset view</button>
            <select aria-label="Go to story node" onChange={event => {
                const id = event.target.value;
                setSelectedId(id);
                const position = positions[id];
                if (position) update({ ...preferences, pan: { x: 20 - position.x * preferences.zoom, y: 20 - position.y * preferences.zoom } });
            }} style={{ ...fieldStyle, maxWidth: '100%' }} value={selected?.id ?? ''}><option value="">Go to node...</option>{filtered.nodes.map(node => <option key={node.id} value={node.id}>{node.kind}: {node.label}</option>)}</select>
        </div>
        <div style={{ color: t.text.muted, padding: '0 8px 8px' }}>{filtered.nodes.length} of {map.nodes.length} nodes. Dashed links call macros. Green marks visited scenes and scene transitions from the last playtest. These are potential routes and do not evaluate conditions.</div>
        <StoryMapCanvas map={filtered} onOpen={open} onSelect={setSelectedId} positions={positions} preferences={preferences} selectedId={selectedId} update={update} visited={visited} visitedEdges={visitedEdges} />
        <div style={{ maxHeight: '35%', overflow: 'auto', padding: 8 }}>
            <div>Drag the background to pan or a node to arrange it. Arrow keys move between nodes. Enter or double-click opens the source.</div>
            {warning || message ? <p role="status">{message || warning}</p> : undefined}
            {selected ? <div>
                <strong>{selected.kind}: {selected.label}</strong>{selected.missing ? ' / Missing' : (selected.reachable ? '' : ' / Unreachable')}
                <button className="toolbar-btn" disabled={!selected.source} onClick={() => open(selected)} type="button">Open source</button>
                {links.map(edge => <div key={edge.id} style={{ alignItems: 'center', display: 'flex', gap: 6, marginTop: 4 }}>
                    <span>{map.nodes.find(node => node.id === edge.from)?.label} → {map.nodes.find(node => node.id === edge.to)?.label}: {edge.label}</span>
                    <button className="toolbar-btn" disabled={!edge.source} onClick={() => { if (edge.source) void openStoryMapSource(edge.source).catch(error => setMessage(String(error))); }} type="button">Open command</button>
                </div>)}
            </div> : <div>Select a node to inspect its connections.</div>}
            {map.issues.length > 0 ? <details><summary>{map.issues.length} story issues</summary>{map.issues.map((issue, index) => <p key={`${index}:${issue}`}>{issue}</p>)}</details> : undefined}
        </div>
    </section>;
}

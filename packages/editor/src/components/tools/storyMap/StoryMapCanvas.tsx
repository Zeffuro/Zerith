import { useEffect, useRef, useState } from 'react';

import type { StoryMap, StoryMapNode, StoryMapPosition } from '../../../services/storyMap/storyMapModel';
import type { StoryMapPreferences } from '../../../services/storyMap/storyMapPreferences';

import { nextStoryMapNode } from '../../../services/storyMap/storyMapModel';
import { editorTheme as t } from '../../../theme/editorTheme';

type Properties = {
    map: StoryMap;
    onOpen: (node: StoryMapNode) => void;
    onSelect: (id: string) => void;
    positions: Record<string, StoryMapPosition>;
    preferences: StoryMapPreferences;
    selectedId?: string;
    update: (value: StoryMapPreferences) => void;
    visited: Set<string>;
    visitedEdges: Set<string>;
};

export function StoryMapCanvas({ map, onOpen, onSelect, positions, preferences, selectedId, update, visited, visitedEdges }: Properties) {
    const svgReference = useRef<SVGSVGElement>(null);
    const dragReference = useRef<{ id?: string; origin: StoryMapPosition; pointer: StoryMapPosition } | undefined>(undefined);
    const [size, setSize] = useState({ height: 500, width: 600 });
    useEffect(() => {
        const svg = svgReference.current;
        if (!svg) return;
        const observer = new ResizeObserver(entries => {
            const rect = entries[0]?.contentRect;
            if (rect) setSize({ height: rect.height, width: rect.width });
        });
        observer.observe(svg);
        return () => observer.disconnect();
    }, []);
    const inView = (position: StoryMapPosition) => {
        const x = position.x * preferences.zoom + preferences.pan.x;
        const y = position.y * preferences.zoom + preferences.pan.y;
        return x < size.width + 200 && x + 180 * preferences.zoom > -200 && y < size.height + 100 && y + 70 * preferences.zoom > -100;
    };
    const visibleNodes = map.nodes.filter(node => inView(positions[node.id]));
    const visibleIds = new Set(visibleNodes.map(node => node.id));
    const center = (id: string) => {
        const position = positions[id];
        if (!position) return;
        onSelect(id);
        update({ ...preferences, pan: { x: size.width / 2 - (position.x + 90) * preferences.zoom, y: size.height / 2 - (position.y + 35) * preferences.zoom } });
        requestAnimationFrame(() => document.querySelector<SVGGElement>(`#${CSS.escape(`story-map-${id}`)}`)?.focus());
    };
    return <svg aria-label="Story map canvas" onKeyDown={event => {
        const directions = { ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up' } as const;
        const direction = directions[event.key as keyof typeof directions];
        if (direction) {
            event.preventDefault();
            const next = nextStoryMapNode(selectedId ?? map.nodes[0]?.id ?? '', direction, map.nodes, positions);
            if (next) center(next);
        }
        if (event.key === 'Home' && map.nodes[0]) { event.preventDefault(); center(map.nodes.some(node => node.id === map.startId) ? map.startId! : map.nodes[0].id); }
        if (event.key === 'Enter') { event.preventDefault(); const node = map.nodes.find(value => value.id === selectedId); if (node) onOpen(node); }
    }} onPointerCancel={() => { dragReference.current = undefined; }} onPointerDown={event => {
        if (event.button !== 0) return;
        const element = event.target as Element;
        const id = element.closest<SVGElement>('[data-node-id]')?.dataset.nodeId;
        if (id) onSelect(id);
        dragReference.current = { id, origin: id ? positions[id] : preferences.pan, pointer: { x: event.clientX, y: event.clientY } };
        event.currentTarget.setPointerCapture(event.pointerId);
    }} onPointerMove={event => {
        const drag = dragReference.current;
        if (!drag) return;
        const delta = { x: event.clientX - drag.pointer.x, y: event.clientY - drag.pointer.y };
        if (drag.id) update({ ...preferences, positions: { ...preferences.positions, [drag.id]: { x: drag.origin.x + delta.x / preferences.zoom, y: drag.origin.y + delta.y / preferences.zoom } } });
        else update({ ...preferences, pan: { x: drag.origin.x + delta.x, y: drag.origin.y + delta.y } });
    }} onPointerUp={() => { dragReference.current = undefined; }} onWheel={event => {
        const zoom = Math.min(2, Math.max(.2, preferences.zoom * (event.deltaY > 0 ? .9 : 1.1)));
        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        update({ ...preferences, pan: { x: x - (x - preferences.pan.x) * zoom / preferences.zoom, y: y - (y - preferences.pan.y) * zoom / preferences.zoom }, zoom });
    }} ref={svgReference} role="group" style={{ background: t.bg.popup, flex: 1, minHeight: 280, outline: 'none', touchAction: 'none', width: '100%' }} tabIndex={0}>
        <defs><marker id="story-map-arrow" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4"><path d="M0 0 L8 4 L0 8 Z" fill={t.text.muted} /></marker></defs>
        <g transform={`translate(${preferences.pan.x} ${preferences.pan.y}) scale(${preferences.zoom})`}>
            {map.edges.filter(edge => visibleIds.has(edge.from) || visibleIds.has(edge.to)).map(edge => {
                const from = positions[edge.from];
                const to = positions[edge.to];
                if (!from || !to) return;
                return <path d={edge.from === edge.to ? `M${from.x + 90} ${from.y} C${from.x + 240} ${from.y - 70} ${from.x - 50} ${from.y - 70} ${from.x + 20} ${from.y}` : `M${from.x + 180} ${from.y + 35} C${from.x + 210} ${from.y + 35} ${to.x - 30} ${to.y + 35} ${to.x} ${to.y + 35}`} data-visited-route={visitedEdges.has(edge.id) ? 'true' : undefined} fill="none" key={edge.id} markerEnd="url(#story-map-arrow)" stroke={visitedEdges.has(edge.id) ? t.accent.green : t.text.muted} strokeDasharray={edge.type === 'call' ? '6 4' : undefined} strokeWidth={visitedEdges.has(edge.id) ? 3 : 1.5}><title>{edge.label}{visitedEdges.has(edge.id) ? ' / Playtest scene transition' : ''}</title></path>;
            })}
            {visibleNodes.map(node => {
                const position = positions[node.id];
                let color: string = t.accent.primary;
                if (node.kind === 'macro') color = t.accent.purple;
                if (visited.has(node.id)) color = t.accent.green;
                if (node.missing) color = t.accent.red;
                return <g aria-label={`${node.kind} ${node.label}${node.missing ? ', missing' : (node.reachable ? '' : ', unreachable')}${visited.has(node.id) ? ', visited' : ''}`} data-node-id={node.id} id={`story-map-${node.id}`} key={node.id} onClick={() => onSelect(node.id)} onDoubleClick={() => onOpen(node)} onFocus={() => onSelect(node.id)} role="button" style={{ cursor: 'pointer', outline: 'none' }} tabIndex={selectedId === node.id || (!selectedId && node.id === map.nodes[0]?.id) ? 0 : -1} transform={`translate(${position.x} ${position.y})`}>
                    <title>{node.label}</title>
                    <rect fill={t.bg.panel} height={70} rx={node.kind === 'choice' ? 24 : 8} stroke={color} strokeDasharray={!node.reachable && !node.missing ? '4 3' : undefined} strokeWidth={selectedId === node.id ? 4 : 2} width={180} />
                    <text fill={t.text.muted} fontSize={11} x={12} y={22}>{node.kind.toUpperCase()}{visited.has(node.id) ? ' / VISITED' : ''}</text>
                    <text fill={t.text.primary} fontSize={14} x={12} y={47}>{node.label.length > 22 ? `${node.label.slice(0, 21)}...` : node.label}</text>
                </g>;
            })}
        </g>
    </svg>;
}

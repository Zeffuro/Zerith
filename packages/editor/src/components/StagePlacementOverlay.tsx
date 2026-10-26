import type { Engine } from '@zeffuro/zerith-core';
import type { RefObject } from 'react';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { PlacementBoundary, StageTransform } from '../services/stagePlacement';
import type { EditorNode } from '../types/EditorNode';
import type { ScriptPath } from '../utils/scriptPathUtilities';

import { createPlacementBoundary, findPlacementTarget, isPlacementCommand, ownsPlacementPath, placementBoundaryIndex, placementFromCommand, placementInsertionIndex, retainPlacementBoundary, snappedPosition } from '../services/stagePlacement';
import { useProjectStore, useScriptStore } from '../store/storeBootstrap';
import { useEngineBridgeStore } from '../store/useEngineBridgeStore';
import { StagePlacementControls } from './StagePlacementControls';
import './StagePlacement.css';

type Box = { height: number; id: string; left: number; top: number; width: number };
type Drag = { clientX: number; clientY: number; pointerId: number; selected: Selection; start: StageTransform };
type LiveSprite = ReturnType<Engine['display']['getLayer']>['children'][number];
type Properties = { canvas: RefObject<HTMLCanvasElement | null>; container: RefObject<HTMLDivElement | null>; onActiveChange: (enabled: boolean) => void; tools?: HTMLDivElement };
type Selection = { baseline: StageTransform; createdPath?: ScriptPath; id: string; insertion: number; path?: ScriptPath; source: EditorNode[]; sprite: LiveSprite };

export function StagePlacementOverlay({ canvas, container, onActiveChange, tools }: Properties) {
    const engine = useEngineBridgeStore(state => state.engine);
    const sourceFile = useEngineBridgeStore(state => state.previewSourceFile);
    const rootScript = useScriptStore(state => state.rootScript);
    const activeFile = useProjectStore(state => state.activeFile);
    const characters = useProjectStore(state => state.characters);
    const [enabled, setEnabled] = useState(false);
    const [canPlace, setCanPlace] = useState(false);
    const [boxes, setBoxes] = useState<Box[]>([]);
    const [viewport, setViewport] = useState({ height: 0, left: 0, top: 0, width: 0 });
    const [selection, setSelection] = useState<Selection>();
    const [grid, setGrid] = useState(16);
    const [showGuides, setGuides] = useState(false);
    const [message, setMessage] = useState('');
    const boundary = useRef<PlacementBoundary | undefined>(undefined);
    const boundaryOwner = useRef<{ index: number; scene: string; source: EditorNode[] } | undefined>(undefined);
    const loadingSource = useRef<EditorNode[] | undefined>(undefined);
    const previewOwner = useRef({ engine, sourceFile });
    const tracked = useRef(new Map<string, Selection>());
    const drag = useRef<Drag | undefined>(undefined);
    const ownsSource = useCallback(() => {
        if (!engine || useEngineBridgeStore.getState().engine !== engine || engine.display.canvas !== canvas.current) return false;
        const project = useProjectStore.getState();
        const path = engine.currentSceneName === 'preview' ? useEngineBridgeStore.getState().previewSourceFile : project.scenePaths[engine.currentSceneName];
        return !!path && path.replaceAll('\\', '/') === project.activeFile?.replaceAll('\\', '/');
    }, [canvas, engine]);
    const cancelDrag = useCallback(() => {
        const gesture = drag.current;
        drag.current = undefined;
        if (gesture && !gesture.selected.sprite.destroyed) {
            applyTransform(gesture.selected.sprite, gesture.start);
            engine?.display.render?.();
        }
    }, [engine]);

    useEffect(() => {
        cancelDrag();
        if (previewOwner.current.engine !== engine || previewOwner.current.sourceFile !== sourceFile) {
            const source = useScriptStore.getState().rootScript;
            boundary.current = engine ? createPlacementBoundary(source, engine.scenes.getLastOriginalIndex(engine.currentIndex - 1)) : undefined;
            boundaryOwner.current = engine ? { index: engine.currentIndex, scene: engine.currentSceneName, source } : undefined;
            previewOwner.current = { engine, sourceFile };
        }
        tracked.current.clear();
        setSelection(undefined);
        setBoxes([]);
        setEnabled(false);
        setMessage('');
        return cancelDrag;
    }, [activeFile, cancelDrag, engine, sourceFile]);

    useEffect(() => {
        onActiveChange(enabled);
        if (!engine || !enabled) return;
        const release = engine.flow.acquireSuspension?.();
        const releaseRender = engine.display.acquireRenderSuspension?.();
        engine.pause();
        engine.setInputEnabled(false);
        engine.display.render?.();
        return () => { cancelDrag(); releaseRender?.(); release?.(); };
    }, [cancelDrag, enabled, engine, onActiveChange]);

    useEffect(() => {
        if (!engine) return;
        const update = () => setCanPlace(engine.isStarted && !engine.flow.isBusy && ownsSource());
        const loading = () => { loadingSource.current = useScriptStore.getState().rootScript; };
        const loaded = () => {
            const source = useScriptStore.getState().rootScript;
            boundary.current = !loadingSource.current || loadingSource.current === source ? createPlacementBoundary(source, engine.scenes.getLastOriginalIndex(engine.currentIndex - 1)) : undefined;
            boundaryOwner.current = { index: engine.currentIndex, scene: engine.currentSceneName, source: loadingSource.current ?? source };
            loadingSource.current = undefined;
            tracked.current.clear();
            setSelection(undefined);
            setEnabled(false);
            update();
        };
        update();
        const timer = globalThis.setInterval(update, 100);
        engine.events.on('flow:command', update);
        engine.events.on('scene:loading', loading);
        engine.events.on('scene:loaded', loaded);
        return () => { globalThis.clearInterval(timer); engine.events.off('flow:command', update); engine.events.off('scene:loading', loading); engine.events.off('scene:loaded', loaded); };
    }, [activeFile, engine, ownsSource, sourceFile]);

    useEffect(() => {
        if (!engine || !enabled) return;
        const update = () => {
            if (!canvas.current || !container.current || engine.display.canvas !== canvas.current || useEngineBridgeStore.getState().engine !== engine) return;
            const rect = canvas.current.getBoundingClientRect();
            const parent = container.current.getBoundingClientRect();
            const scaleX = rect.width / engine.display.width;
            const scaleY = rect.height / engine.display.height;
            setViewport({ height: rect.height, left: rect.left - parent.left, top: rect.top - parent.top, width: rect.width });
            setBoxes(engine.display.getLayer('sprites').children.filter(child => child.label.startsWith('zerith-sprite:') && child.visible && child.alpha > 0).map(child => {
                const bounds = child.getBounds();
                return { height: bounds.height * scaleY, id: child.label.slice('zerith-sprite:'.length), left: bounds.x * scaleX, top: bounds.y * scaleY, width: bounds.width * scaleX };
            }));
        };
        update();
        const timer = globalThis.setInterval(update, 80);
        return () => globalThis.clearInterval(timer);
    }, [canvas, container, enabled, engine]);

    useEffect(() => {
        if (!enabled || !engine || drag.current || !ownsSource()) return;
        let changed = false;
        const ownsBoundary = placementBoundaryIndex(boundary.current, rootScript) !== undefined;
        for (const [id, candidate] of tracked.current) {
            if (candidate.sprite.destroyed) { tracked.current.delete(id); continue; }
            const path = candidate.path ?? candidate.createdPath;
            const command = path && useScriptStore.getState().getNodeAtPath(path);
            let next: Selection | undefined;
            if (command && !Array.isArray(command) && isPlacementCommand(command, id)) {
                if (candidate.path && !ownsPlacementPath(candidate.source, rootScript, candidate.path)) {
                    tracked.current.delete(id);
                    if (selection?.id === id) {
                        setSelection(undefined);
                        setMessage('Select the character again after rearranging its commands.');
                    }
                    continue;
                }
                if (candidate.source === rootScript) continue;
                applyTransform(candidate.sprite, placementFromCommand(command, candidate.baseline, engine.display.width, engine.display.height, characters[id]?.displayDefaults?.flip));
                next = { ...candidate, path, source: rootScript };
            } else if (ownsBoundary && (candidate.createdPath || !candidate.path)) {
                if (!candidate.path && candidate.source === rootScript) continue;
                applyTransform(candidate.sprite, candidate.baseline);
                next = { ...candidate, path: undefined, source: rootScript };
            }
            if (next) { tracked.current.set(id, next); changed = true; }
            else tracked.current.delete(id);
            if (selection?.id === id) setSelection(next);
        }
        if (changed) engine.display.render?.();
    }, [characters, enabled, engine, ownsSource, rootScript, selection]);

    const select = (id: string): Selection | undefined => {
        if (!engine || !ownsSource()) return;
        const store = useScriptStore.getState();
        const explicit = store.selectedNodePath && store.getNodeAtPath(store.selectedNodePath);
        const explicitPath = explicit && !Array.isArray(explicit) && isPlacementCommand(explicit, id) ? store.selectedNodePath : undefined;
        const owner = boundaryOwner.current;
        const index = owner?.index === engine.currentIndex && owner.scene === engine.currentSceneName ? placementBoundaryIndex(boundary.current, store.rootScript) : undefined;
        if (!explicitPath && index === undefined) {
            setSelection(undefined);
            setMessage('Play the scene again after changing its commands.');
            return;
        }
        if (!explicitPath && index !== undefined && ['call', 'choice'].includes(store.rootScript[index]?.type)) {
            setSelection(undefined);
            setMessage('Select this character’s command in the current branch or macro to edit its position.');
            return;
        }
        const path = explicitPath ?? findPlacementTarget(store.rootScript, id, index ?? 0);
        if (!path && (index === undefined || store.rootScript[index]?.type !== 'dialogue')) {
            setMessage('Place this character when the scene reaches a dialogue line.');
            return;
        }
        const sprite = engine.display.getLayer('sprites').children.find(child => child.label === `zerith-sprite:${id}`);
        if (!sprite) return;
        const previous = tracked.current.get(id);
        const same = previous?.sprite === sprite && JSON.stringify(previous.path) === JSON.stringify(path);
        const insertion = path ? 0 : placementInsertionIndex(store.rootScript, index!);
        const selected = same ? { ...previous, insertion } : { baseline: readTransform(sprite), id, insertion, path, source: store.rootScript, sprite };
        tracked.current.set(id, selected);
        setSelection(selected);
        if (path) store.setSelectedNodePath(path);
        setMessage(path ? '' : 'Moving this character adds a position command to this scene. Shared macros stay unchanged.');
        return selected;
    };

    const commit = (selected: Selection, patch: Record<string, unknown>) => {
        if (!engine || !ownsSource() || selected.sprite.destroyed) return;
        const store = useScriptStore.getState();
        const before = store.rootScript;
        if (selected.path) {
            if (!ownsPlacementPath(selected.source, store.rootScript, selected.path)) { setSelection(undefined); setMessage('Select the character again after rearranging its commands.'); return; }
            const command = store.getNodeAtPath(selected.path);
            if (!command || Array.isArray(command) || !isPlacementCommand(command, selected.id)) { setMessage('Select the character again after changing its command.'); return; }
            store.updateNodeAtPath(selected.path, patch);
            retainPlacementBoundary(boundary.current, before, useScriptStore.getState().rootScript);
        } else {
            if (selected.source !== store.rootScript) { setMessage('Select the character again after changing the scene.'); return; }
            const command = { action: 'move', duration: 0, id: selected.id, type: 'sprite', ...patch } as EditorNode;
            store.addNodeAtPath([], command, selected.insertion);
            retainPlacementBoundary(boundary.current, before, useScriptStore.getState().rootScript, selected.insertion);
            const path = [selected.insertion];
            store.setSelectedNodePath(path);
            applyTransform(selected.sprite, placementFromCommand(command as Parameters<typeof placementFromCommand>[0], selected.baseline, engine.display.width, engine.display.height));
            engine.display.render?.();
            const next = { ...selected, createdPath: path, path, source: useScriptStore.getState().rootScript };
            tracked.current.set(selected.id, next);
            setSelection(next);
        }
    };

    const beginDrag = (event: React.PointerEvent<HTMLButtonElement>, id: string) => {
        if (event.button !== 0) return;
        event.preventDefault(); event.stopPropagation();
        event.currentTarget.focus();
        const selected = select(id);
        if (!selected) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { clientX: event.clientX, clientY: event.clientY, pointerId: event.pointerId, selected, start: readTransform(selected.sprite) };
    };
    const move = (event: React.PointerEvent<HTMLButtonElement>) => {
        const gesture = drag.current;
        if (!gesture || !engine || !canvas.current || gesture.pointerId !== event.pointerId || !ownsSource()) return;
        const rect = canvas.current.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const position = snappedPosition(gesture.start.x + (event.clientX - gesture.clientX) * engine.display.width / rect.width, gesture.start.y + (event.clientY - gesture.clientY) * engine.display.height / rect.height, engine.display.width, engine.display.height, grid);
        gesture.selected.sprite.position.set(position.x, position.y);
        engine.display.render?.();
    };
    const finish = (event: React.PointerEvent<HTMLButtonElement>, cancelled = false) => {
        const gesture = drag.current;
        if (!gesture || gesture.pointerId !== event.pointerId) return;
        if (cancelled || !ownsSource()) { cancelDrag(); return; }
        drag.current = undefined;
        const { x, y } = gesture.selected.sprite;
        if (x !== gesture.start.x || y !== gesture.start.y) commit(gesture.selected, { x, xRatio: undefined, y, yRatio: undefined });
    };
    const position = (axis: 'x' | 'y', value: number) => {
        if (!selection || !engine) return;
        const maximum = axis === 'x' ? engine.display.width : engine.display.height;
        commit(selection, { [`${axis}Ratio`]: undefined, [axis]: Math.round(Math.min(maximum, Math.max(0, value))) });
    };

    if (!engine || !tools) return;
    return <>
        {createPortal(<div onFocus={() => engine.setInputEnabled(false)}><StagePlacementControls canPlace={canPlace} characters={boxes.map(box => ({ id: box.id, label: characters[box.id]?.name ?? box.id }))} enabled={enabled} grid={grid} message={message} onCenter={() => position('x', engine.display.width / 2)} onLayer={direction => {
            if (selection && ownsSource()) commit(selection, { zIndex: direction > 0 ? Math.max(...engine.display.getLayer('sprites').children.map(sprite => sprite.zIndex)) + 1 : Math.min(...engine.display.getLayer('sprites').children.map(sprite => sprite.zIndex)) - 1 });
        }} onPosition={position} onScale={value => {
            if (selection) commit(selection, { heightRatio: undefined, scaleX: value * Math.sign(selection.sprite.scale.x || 1), scaleY: value * Math.sign(selection.sprite.scale.y || 1), widthRatio: undefined });
        }} onSelect={select} onToggle={() => {
            if (!enabled && (!engine.isStarted || engine.flow.isBusy || !ownsSource())) return;
            cancelDrag();
            if (enabled) setSelection(undefined);
            else {
                const source = useScriptStore.getState().rootScript;
                const owner = boundaryOwner.current;
                const cursorChanged = owner && (owner.index !== engine.currentIndex || owner.scene !== engine.currentSceneName);
                if (!owner || (cursorChanged && owner.source === source)) {
                    boundary.current = createPlacementBoundary(source, engine.scenes.getLastOriginalIndex(engine.currentIndex - 1));
                    boundaryOwner.current = { index: engine.currentIndex, scene: engine.currentSceneName, source };
                }
                if (cursorChanged) tracked.current.clear();
            }
            setEnabled(!enabled);
        }} selectedId={selection?.id} setGrid={setGrid} setGuides={setGuides} showGuides={showGuides} transform={selection && !selection.sprite.destroyed ? readTransform(selection.sprite) : undefined} /></div>, tools)}
        {enabled && <div className="zerith-placement-stage" onFocus={event => { event.stopPropagation(); engine.setInputEnabled(false); }} style={viewport}>
            {showGuides && <>
                <div className="zerith-placement-guide" style={{ borderLeftWidth: 1, height: '100%', left: '50%', top: 0 }} />
                <div className="zerith-placement-guide" style={{ borderTopWidth: 1, left: 0, top: '50%', width: '100%' }} />
            </>}
            {boxes.map(box => <button aria-label={`Place ${box.id}`} aria-pressed={selection?.id === box.id} className="zerith-placement-target" key={box.id} onClick={() => select(box.id)} onKeyDown={event => {
                if (event.key === 'Escape') { event.preventDefault(); cancelDrag(); return; }
                const distance = event.shiftKey ? 10 : 1;
                const offset = ({ ArrowDown: [0, distance], ArrowLeft: [-distance, 0], ArrowRight: [distance, 0], ArrowUp: [0, -distance] } as Record<string, number[]>)[event.key];
                if (offset) {
                    event.preventDefault(); event.stopPropagation();
                    const selected = select(box.id);
                    if (selected) commit(selected, { ...snappedPosition(selected.sprite.x + offset[0], selected.sprite.y + offset[1], engine.display.width, engine.display.height, 0), xRatio: undefined, yRatio: undefined });
                }
            }} onLostPointerCapture={event => finish(event, true)} onPointerCancel={event => finish(event, true)} onPointerDown={event => beginDrag(event, box.id)} onPointerMove={move} onPointerUp={event => finish(event)} style={{ height: Math.max(12, box.height), left: box.left, top: box.top, width: Math.max(12, box.width) }} />)}
        </div>}
    </>;
}

function applyTransform(sprite: LiveSprite, transform: StageTransform): void {
    sprite.position.set(transform.x, transform.y);
    sprite.scale.set(transform.scaleX, transform.scaleY);
    sprite.zIndex = transform.zIndex;
}

function readTransform(sprite: LiveSprite): StageTransform {
    return { scaleX: sprite.scale.x, scaleY: sprite.scale.y, x: sprite.x, y: sprite.y, zIndex: sprite.zIndex };
}

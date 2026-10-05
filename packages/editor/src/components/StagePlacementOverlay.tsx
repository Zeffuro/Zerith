import type { Engine } from '@zeffuro/zerith-core';
import type { RefObject } from 'react';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { StageTransform } from '../services/stagePlacement';
import type { EditorNode } from '../types/EditorNode';
import type { ScriptPath } from '../utils/scriptPathUtilities';

import { findPlacementTarget, isPlacementCommand, ownsPlacementPath, placementFromCommand, placementInsertionIndex, snappedPosition } from '../services/stagePlacement';
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
    const drag = useRef<Drag | undefined>(undefined);
    const ownsSource = useCallback(() => {
        if (!engine || useEngineBridgeStore.getState().engine !== engine) return false;
        const project = useProjectStore.getState();
        const path = engine.currentSceneName === 'preview' ? useEngineBridgeStore.getState().previewSourceFile : project.scenePaths[engine.currentSceneName];
        return !!path && path.replaceAll('\\', '/') === project.activeFile?.replaceAll('\\', '/');
    }, [engine]);
    const cancelDrag = useCallback(() => {
        const gesture = drag.current;
        drag.current = undefined;
        if (gesture && !gesture.selected.sprite.destroyed) applyTransform(gesture.selected.sprite, gesture.start);
    }, []);

    useEffect(() => {
        cancelDrag();
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
        engine.pause();
        engine.setInputEnabled(false);
        return () => { cancelDrag(); release?.(); };
    }, [cancelDrag, enabled, engine, onActiveChange]);

    useEffect(() => {
        if (!engine) return;
        const update = () => setCanPlace(engine.isStarted && !engine.flow.isBusy && ownsSource());
        update();
        const timer = globalThis.setInterval(update, 100);
        engine.events.on('flow:command', update);
        engine.events.on('scene:loaded', update);
        return () => { globalThis.clearInterval(timer); engine.events.off('flow:command', update); engine.events.off('scene:loaded', update); };
    }, [activeFile, engine, ownsSource, sourceFile]);

    useEffect(() => {
        if (!engine || !enabled) return;
        const update = () => {
            if (!canvas.current || !container.current) return;
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
        if (!enabled || !selection || !engine || drag.current || selection.sprite.destroyed || !ownsSource()) return;
        const path = selection.path ?? selection.createdPath;
        const command = path && useScriptStore.getState().getNodeAtPath(path);
        if (command && !Array.isArray(command) && isPlacementCommand(command, selection.id)) {
            if (selection.path && !ownsPlacementPath(selection.source, rootScript, selection.path)) {
                setSelection(undefined);
                setMessage('Select the character again after rearranging its commands.');
                return;
            }
            if (selection.source === rootScript) return;
            applyTransform(selection.sprite, placementFromCommand(command, selection.baseline, engine.display.width, engine.display.height, characters[selection.id]?.displayDefaults?.flip));
            setSelection({ ...selection, path, source: rootScript });
        } else if (selection.createdPath || !selection.path) {
            applyTransform(selection.sprite, selection.baseline);
            if (selection.path || selection.source !== rootScript) setSelection({ ...selection, path: undefined, source: rootScript });
        } else setSelection(undefined);
    }, [characters, enabled, engine, ownsSource, rootScript, selection]);

    const select = (id: string): Selection | undefined => {
        if (!engine || !ownsSource()) return;
        const store = useScriptStore.getState();
        const index = engine.scenes.getLastOriginalIndex(engine.currentIndex - 1);
        const explicit = store.selectedNodePath && store.getNodeAtPath(store.selectedNodePath);
        if (['call', 'choice'].includes(store.rootScript[index]?.type)
            && (!explicit || Array.isArray(explicit) || !isPlacementCommand(explicit, id))) {
            setSelection(undefined);
            setMessage('Select this character’s command in the current branch or macro to edit its position.');
            return;
        }
        const path = findPlacementTarget(store.rootScript, id, index, store.selectedNodePath);
        if (!path && store.rootScript[index]?.type !== 'dialogue') {
            setMessage('Place this character when the scene reaches a dialogue line.');
            return;
        }
        const sprite = engine.display.getLayer('sprites').children.find(child => child.label === `zerith-sprite:${id}`);
        if (!sprite) return;
        const same = selection?.id === id && selection.sprite === sprite && JSON.stringify(selection.path) === JSON.stringify(path);
        const selected = same ? selection : { baseline: readTransform(sprite), id, insertion: placementInsertionIndex(store.rootScript, index), path, source: store.rootScript, sprite };
        setSelection(selected);
        if (path) store.setSelectedNodePath(path);
        setMessage(path ? '' : 'Moving this character adds a position command to this scene. Shared macros stay unchanged.');
        return selected;
    };

    const commit = (selected: Selection, patch: Record<string, unknown>) => {
        if (!engine || !ownsSource() || selected.sprite.destroyed) return;
        const store = useScriptStore.getState();
        if (selected.path) {
            if (!ownsPlacementPath(selected.source, store.rootScript, selected.path)) { setSelection(undefined); setMessage('Select the character again after rearranging its commands.'); return; }
            const command = store.getNodeAtPath(selected.path);
            if (!command || Array.isArray(command) || !isPlacementCommand(command, selected.id)) { setMessage('Select the character again after changing its command.'); return; }
            store.updateNodeAtPath(selected.path, patch);
        } else {
            if (selected.source !== store.rootScript) { setMessage('Select the character again after changing the scene.'); return; }
            const command = { action: 'move', duration: 0, id: selected.id, type: 'sprite', ...patch } as EditorNode;
            store.addNodeAtPath([], command, selected.insertion);
            const path = [selected.insertion];
            store.setSelectedNodePath(path);
            applyTransform(selected.sprite, placementFromCommand(command as Parameters<typeof placementFromCommand>[0], selected.baseline, engine.display.width, engine.display.height));
            setSelection({ ...selected, createdPath: path, path, source: useScriptStore.getState().rootScript });
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
            if (selection) commit(selection, { zIndex: direction > 0 ? Math.max(...engine.display.getLayer('sprites').children.map(sprite => sprite.zIndex)) + 1 : Math.min(...engine.display.getLayer('sprites').children.map(sprite => sprite.zIndex)) - 1 });
        }} onPosition={position} onScale={value => {
            if (selection) commit(selection, { heightRatio: undefined, scaleX: value * Math.sign(selection.sprite.scale.x || 1), scaleY: value * Math.sign(selection.sprite.scale.y || 1), widthRatio: undefined });
        }} onSelect={select} onToggle={() => {
            if (!enabled && (!engine.isStarted || engine.flow.isBusy || !ownsSource())) return;
            cancelDrag();
            if (enabled) setSelection(undefined);
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

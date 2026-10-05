import { Move } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { StageTransform } from '../services/stagePlacement';

type Properties = {
    canPlace: boolean;
    characters: { id: string; label: string }[];
    enabled: boolean;
    grid: number;
    message: string;
    onCenter: () => void;
    onLayer: (direction: -1 | 1) => void;
    onPosition: (axis: 'x' | 'y', value: number) => void;
    onScale: (value: number) => void;
    onSelect: (id: string) => void;
    onToggle: () => void;
    selectedId?: string;
    setGrid: (value: number) => void;
    setGuides: (value: boolean) => void;
    showGuides: boolean;
    transform?: StageTransform;
};

export function StagePlacementControls(properties: Properties) {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState({ left: 0, top: 0 });
    const button = useRef<HTMLButtonElement>(null);
    const popup = useRef<HTMLDivElement>(null);
    const visible = open && properties.enabled;

    useLayoutEffect(() => {
        if (!visible) return;
        const place = () => {
            const anchor = button.current?.getBoundingClientRect();
            const bounds = popup.current?.getBoundingClientRect();
            if (!anchor || !bounds) return;
            setPosition({ left: Math.max(8, Math.min(anchor.right - bounds.width, window.innerWidth - bounds.width - 8)), top: Math.max(8, Math.min(anchor.bottom + 6, window.innerHeight - bounds.height - 8)) });
        };
        place();
        popup.current?.querySelector<HTMLSelectElement>('select')?.focus();
        const observer = new ResizeObserver(place);
        if (button.current) observer.observe(button.current);
        if (popup.current) observer.observe(popup.current);
        window.addEventListener('resize', place);
        return () => { observer.disconnect(); window.removeEventListener('resize', place); };
    }, [visible]);

    useEffect(() => {
        if (!visible) return;
        const dismiss = (event: PointerEvent) => {
            if (!popup.current?.contains(event.target as Node) && !button.current?.contains(event.target as Node)) {
                const focused = document.activeElement;
                if (focused instanceof HTMLElement && popup.current?.contains(focused)) focused.blur();
                setOpen(false);
            }
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { setOpen(false); button.current?.focus(); }
        };
        document.addEventListener('pointerdown', dismiss);
        document.addEventListener('keydown', escape);
        return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape); };
    }, [visible]);

    return <section aria-label="Character placement" className="zerith-placement-header" onPointerDown={event => event.stopPropagation()}>
            <button aria-expanded={visible} aria-haspopup={properties.enabled ? 'dialog' : undefined} aria-label={properties.enabled ? 'Options' : 'Place characters'} aria-pressed={properties.enabled} className="toolbar-btn" disabled={!properties.canPlace && !properties.enabled} onClick={() => {
                if (properties.enabled) setOpen(!visible);
                else { setOpen(false); properties.onToggle(); }
            }} ref={button} title={properties.enabled ? 'Placement options' : (properties.canPlace ? 'Place characters' : 'Play the current scene to arrange its characters')} type="button">
                <Move aria-hidden="true" size={14} />
            </button>
            <span aria-live="polite" className="zerith-placement-announcement">{properties.message}</span>
            {visible && createPortal(<div aria-label="Placement options" className="zerith-placement-controls" ref={popup} role="dialog" style={position}>
                <div className="zerith-placement-popup-heading"><strong>Character placement</strong><button className="toolbar-btn" onClick={() => { setOpen(false); properties.onToggle(); }} type="button">Done</button><button aria-label="Close placement options" className="toolbar-btn" onClick={() => { setOpen(false); button.current?.focus(); }} type="button">Close</button></div>
                <div className="zerith-placement-row">
                <label>Character<select aria-label="Placement character" onChange={event => properties.onSelect(event.target.value)} value={properties.selectedId ?? ''}>
                    <option disabled value="">Select a character</option>
                    {properties.characters.map(character => <option key={character.id} value={character.id}>{character.label}</option>)}
                </select></label>
                <label>Snap<select aria-label="Placement snap" onChange={event => properties.setGrid(Number(event.target.value))} value={properties.grid}>
                    <option value={0}>Off</option><option value={8}>8 px</option><option value={16}>16 px</option><option value={32}>32 px</option>
                </select></label>
                <label><input checked={properties.showGuides} onChange={event => properties.setGuides(event.target.checked)} type="checkbox" />Guides</label>
        </div>
        <div className="zerith-placement-row">
            {(['x', 'y'] as const).map(axis => <label key={axis}>{axis.toUpperCase()}<input aria-label={`Character ${axis.toUpperCase()}`} defaultValue={properties.transform ? Math.round(properties.transform[axis]) : ''} disabled={!properties.transform} key={properties.transform?.[axis] ?? 'empty'} onBlur={event => {
                if (event.target.value !== '' && Number.isFinite(event.target.valueAsNumber)) properties.onPosition(axis, event.target.valueAsNumber);
            }} type="number" /></label>)}
            <label>Scale<input aria-label="Character scale" defaultValue={properties.transform ? Math.round(Math.abs(properties.transform.scaleY) * 100) : ''} disabled={!properties.transform} key={properties.transform?.scaleY ?? 'empty'} max={1000} min={1} onBlur={event => {
                const value = event.target.valueAsNumber / 100;
                if (Number.isFinite(value) && value > 0 && value <= 10) properties.onScale(value);
            }} type="number" />%</label>
            <button className="toolbar-btn" disabled={!properties.transform} onClick={properties.onCenter} type="button">Center</button>
            <button className="toolbar-btn" disabled={!properties.transform} onClick={() => properties.onLayer(1)} type="button">Bring forward</button>
            <button className="toolbar-btn" disabled={!properties.transform} onClick={() => properties.onLayer(-1)} type="button">Send back</button>
        </div>
        <p className="zerith-placement-note">{properties.message || 'Drag a character to move it. Arrow keys move it by one pixel.'}</p>
            </div>, document.body)}
    </section>;
}

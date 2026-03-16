import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import type { NonMacroEditorCommandType } from '../../../plugins/types';

import { useDismissiblePopup } from '../../../hooks/useDismissiblePopup';
import { editorTheme as t } from '../../../theme/editorTheme';
import { styles } from '../../../theme/styleHelpers';

type CommandItem = { icon?: ReactNode; label: string; type: NonMacroEditorCommandType; };

export function AddCommandMenu({
                                   items,
                                   onAdd,
                                   uiScale,
                               }: {
    items: CommandItem[];
    onAdd: (type: NonMacroEditorCommandType) => void;
    uiScale: number;
}) {
    const[open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const rootReference = useRef<HTMLDivElement>(null);
    const inputReference = useRef<HTMLInputElement>(null);

    useDismissiblePopup(open, rootReference, () => setOpen(false));

    useEffect(() => {
        if (!open) return;
        const t = setTimeout(() => inputReference.current?.focus(), 0);
        return () => clearTimeout(t);
    }, [open]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return items;
        return items.filter(
            (x) => x.label.toLowerCase().includes(q) || x.type.toLowerCase().includes(q)
        );
    }, [query, items]);

    return (
        <div ref={rootReference} style={{ position: 'relative' }}>
            <button
                onClick={() => setOpen((v) => !v)}
                style={{
                    alignItems: 'center',
                    background: t.accent.primary,
                    border: `1px solid ${t.border.primaryBtn}`,
                    borderRadius: t.radius.md,
                    boxSizing: 'border-box',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    fontSize: '0.85em',
                    fontWeight: 'bold',
                    height: `${26 * uiScale}px`,
                    justifyContent: 'center',
                    padding: `0 ${10 * uiScale}px`,
                }}
            >
                + Add Command
            </button>

            {open && (
                <div
                    className="zerith-scrollbar"
                    style={{
                        ...styles.popup(uiScale),
                        left: 0,
                        maxHeight: `${340 * uiScale}px`,
                        overflowY: 'auto',
                        position: 'absolute',
                        top: `calc(100% + ${6 * uiScale}px)`,
                        width: `${280 * uiScale}px`,
                        zIndex: 1000,
                    }}
                >
                    <input
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search commands..."
                        ref={inputReference}
                        style={{
                            ...styles.input(uiScale),
                            fontSize: '0.85em',
                            marginBottom: `${8 * uiScale}px`,
                            padding: `${6 * uiScale}px`,
                        }}
                        type="text"
                        value={query}
                    />

                    {filtered.map((item) => (
                        <button
                            key={item.type}
                            onClick={() => {
                                onAdd(item.type);
                                setOpen(false);
                                setQuery('');
                            }}
                            onMouseEnter={(event) => (event.currentTarget.style.background = t.bg.hover)}
                            onMouseLeave={(event) => (event.currentTarget.style.background = 'transparent')}
                            style={{
                                alignItems: 'center',
                                background: 'transparent',
                                border: 'none',
                                borderRadius: '4px',
                                color: t.text.normal,
                                cursor: 'pointer',
                                display: 'flex',
                                fontSize: '0.85em',
                                gap: `${8 * uiScale}px`,
                                padding: `${7 * uiScale}px ${6 * uiScale}px`,
                                textAlign: 'left',
                                width: '100%',
                            }}
                        >
                            <span style={{ alignItems: 'center', display: 'inline-flex' }}>{item.icon}</span>
                            <span>{item.label}</span>
                            <span style={{ color: t.text.faint, marginLeft: 'auto' }}>({item.type})</span>
                        </button>
                    ))}

                    {filtered.length === 0 && (
                        <div style={{ color: t.text.faint, fontSize: '0.85em', padding: `${6 * uiScale}px` }}>
                            No commands found.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
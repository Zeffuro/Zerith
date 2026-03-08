import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useDismissiblePopup } from '../../../hooks/useDismissiblePopup';
import { editorTheme as t } from '../../../theme/editorTheme';
import { styles } from '../../../theme/styleHelpers';

type CommandItem = { type: string; label: string; icon?: ReactNode };

export function AddCommandMenu({
                                   uiScale,
                                   onAdd,
                                   items,
                               }: {
    uiScale: number;
    onAdd: (type: string) => void;
    items: CommandItem[];
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const rootRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useDismissiblePopup(open, rootRef, () => setOpen(false));

    useEffect(() => {
        if (!open) return;
        const t = setTimeout(() => inputRef.current?.focus(), 0);
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
        <div ref={rootRef} style={{ position: 'relative' }}>
            <button
                onClick={() => setOpen((v) => !v)}
                style={{
                    background: t.accent.primary,
                    border: `1px solid ${t.border.primaryBtn}`,
                    color: t.text.primary,
                    borderRadius: t.radius.md,
                    padding: `0 ${10 * uiScale}px`,
                    height: `${26 * uiScale}px`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                    fontSize: '0.85em',
                    fontWeight: 'bold',
                }}
            >
                + Add Command
            </button>

            {open && (
                <div
                    className="zerith-scrollbar"
                    style={{
                        ...styles.popup(uiScale),
                        position: 'absolute',
                        top: `calc(100% + ${6 * uiScale}px)`,
                        left: 0,
                        width: `${280 * uiScale}px`,
                        maxHeight: `${340 * uiScale}px`,
                        overflowY: 'auto',
                        zIndex: 1000,
                    }}
                >
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search commands..."
                        style={{
                            ...styles.input(uiScale),
                            marginBottom: `${8 * uiScale}px`,
                            background: '#111',
                            color: '#ddd',
                            border: '1px solid #333',
                            padding: `${6 * uiScale}px`,
                            fontSize: '0.85em',
                        }}
                    />

                    {filtered.map((item) => (
                        <button
                            key={item.type}
                            onClick={() => {
                                onAdd(item.type);
                                setOpen(false);
                                setQuery('');
                            }}
                            style={{
                                width: '100%',
                                textAlign: 'left',
                                background: 'transparent',
                                border: 'none',
                                color: '#ddd',
                                padding: `${7 * uiScale}px ${6 * uiScale}px`,
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '0.85em',
                                display: 'flex',
                                alignItems: 'center',
                                gap: `${8 * uiScale}px`,
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = t.bg.hover)}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                            <span style={{ display: 'inline-flex', alignItems: 'center' }}>{item.icon}</span>
                            <span>{item.label}</span>
                            <span style={{ color: '#777', marginLeft: 'auto' }}>({item.type})</span>
                        </button>
                    ))}

                    {filtered.length === 0 && (
                        <div style={{ color: '#777', fontSize: '0.85em', padding: `${6 * uiScale}px` }}>
                            No commands found.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

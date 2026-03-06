import { useEffect, useMemo, useRef, useState } from 'react';

type CommandItem = { type: string; label: string };

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

    useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            if (!rootRef.current) return;
            if (!rootRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, []);

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
                    background: '#0e639c',
                    border: '1px solid #1f7ab7',
                    color: '#fff',
                    borderRadius: '4px',
                    padding: `${6 * uiScale}px ${10 * uiScale}px`,
                    cursor: 'pointer',
                    fontSize: '0.85em',
                    fontWeight: 'bold',
                }}
            >
                + Add Command
            </button>

            {open && (
                <div style={{
                    position: 'absolute',
                    top: `calc(100% + ${6 * uiScale}px)`,
                    left: 0,
                    width: `${260 * uiScale}px`,
                    maxHeight: `${320 * uiScale}px`,
                    overflowY: 'auto',
                    background: '#1f1f1f',
                    border: '1px solid #3a3a3a',
                    borderRadius: '6px',
                    zIndex: 1000,
                    boxShadow: '0 8px 20px rgba(0,0,0,0.35)',
                    padding: `${8 * uiScale}px`,
                }}>
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search commands..."
                        style={{
                            width: '100%',
                            marginBottom: `${8 * uiScale}px`,
                            background: '#111',
                            color: '#ddd',
                            border: '1px solid #333',
                            borderRadius: '4px',
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
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#2a2a2a')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                            {item.label}
                            <span style={{ color: '#777', marginLeft: '6px' }}>({item.type})</span>
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
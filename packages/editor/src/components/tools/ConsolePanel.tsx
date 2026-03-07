import { useEffect, useMemo, useRef, useState } from 'react';
import { useConsoleStore } from '../../store/useConsoleStore';
import { useEditorStore } from '../../store/useEditorStore';
import { editorTheme as t } from '../../theme/editorTheme';
import { Trash2, Copy } from 'lucide-react';

export function ConsolePanel() {
    const uiScale = useEditorStore((s) => s.uiScale);
    const { messages, clear } = useConsoleStore();
    const endRef = useRef<HTMLDivElement>(null);

    const [sourceFilter, setSourceFilter] = useState<'all' | 'editor' | 'engine'>('all');

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'auto' });
    }, [messages]);

    const filtered = useMemo(() => {
        if (sourceFilter === 'all') return messages;
        return messages.filter((m) => m.source === sourceFilter);
    }, [messages, sourceFilter]);

    const copyText = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
        } catch (err) {
            console.warn('Clipboard write failed:', err);
        }
    };

    const copyAll = async () => {
        const payload = filtered
            .map((m) => `[${m.timestamp.toLocaleTimeString()}][${m.source}][${m.type}] ${m.text}`)
            .join('\n');
        await copyText(payload);
    };

    const getColor = (type: string) => {
        if (type === 'error') return t.accent.red;
        if (type === 'warn') return '#fbbf24';
        if (type === 'info') return '#60a5fa';
        return t.text.normal;
    };

    const chip = (value: 'all' | 'editor' | 'engine', label: string) => {
        const active = sourceFilter === value;
        return (
            <button
                onClick={() => setSourceFilter(value)}
                style={{
                    border: `1px solid ${active ? t.border.accent : t.border.subtle}`,
                    background: active ? t.bg.selected : 'transparent',
                    color: active ? t.text.primary : t.text.muted,
                    borderRadius: t.radius.sm,
                    cursor: 'pointer',
                    fontSize: `${11 * uiScale}px`,
                    padding: `${2 * uiScale}px ${6 * uiScale}px`,
                }}
            >
                {label}
            </button>
        );
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: t.bg.app }}>
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: `${4 * uiScale}px ${8 * uiScale}px`,
                    background: t.bg.panel,
                    borderBottom: `1px solid ${t.border.subtle}`,
                    gap: `${6 * uiScale}px`,
                }}
            >
                <span style={{ fontWeight: 'bold', fontSize: `${11 * uiScale}px`, color: t.text.muted }}>
                    LOGS
                </span>

                <div style={{ display: 'flex', gap: `${4 * uiScale}px`, marginLeft: 'auto' }}>
                    {chip('all', 'All')}
                    {chip('editor', 'Editor')}
                    {chip('engine', 'Engine')}
                </div>

                <button
                    onClick={copyAll}
                    title="Copy visible logs"
                    style={{ background: 'transparent', border: 'none', color: t.text.muted, cursor: 'pointer' }}
                >
                    <Copy size={14 * uiScale} />
                </button>

                <button
                    onClick={clear}
                    title="Clear Console"
                    style={{ background: 'transparent', border: 'none', color: t.text.muted, cursor: 'pointer' }}
                >
                    <Trash2 size={14 * uiScale} />
                </button>
            </div>

            <div
                className="zerith-scrollbar"
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: `${8 * uiScale}px`,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    fontSize: `${12 * uiScale}px`,
                }}
            >
                {filtered.length === 0 && <div style={{ color: t.text.faint, fontStyle: 'italic' }}>No logs yet...</div>}

                {filtered.map((msg) => (
                    <div
                        key={msg.id}
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'auto 1fr auto',
                            gap: '8px',
                            marginBottom: '4px',
                            color: getColor(msg.type),
                            borderBottom: `1px solid ${t.bg.panel}`,
                            paddingBottom: '4px',
                            alignItems: 'start',
                        }}
                    >
                        <span style={{ opacity: 0.5, whiteSpace: 'nowrap' }}>
                            [{msg.timestamp.toLocaleTimeString()}]
                        </span>

                        <span
                            style={{
                                wordBreak: 'break-word',
                                whiteSpace: 'pre-wrap',
                                userSelect: 'text',
                                WebkitUserSelect: 'text',
                            }}
                        >
                            [{msg.source}] {msg.text}
                        </span>

                        <button
                            onClick={() =>
                                copyText(`[${msg.timestamp.toLocaleTimeString()}][${msg.source}][${msg.type}] ${msg.text}`)
                            }
                            title="Copy line"
                            style={{ background: 'transparent', border: 'none', color: t.text.muted, cursor: 'pointer' }}
                        >
                            <Copy size={12 * uiScale} />
                        </button>
                    </div>
                ))}
                <div ref={endRef} />
            </div>
        </div>
    );
}